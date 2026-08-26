import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { extname, join, parse } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const sourceRoot = fileURLToPath(new URL('../assets/raw/绿幕动画/', import.meta.url))
const processedRoot = fileURLToPath(new URL('../assets/raw/动画/', import.meta.url))
const characterRoot = fileURLToPath(new URL('../assets/characters/', import.meta.url))
const videoExtensions = new Set(['.mp4', '.mov', '.mkv', '.webm'])
const outputSize = 720

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with ${code}`))
    })
  })
}

function capture(command, args) {
  return new Promise((resolve, reject) => {
    const output = []
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'inherit'] })
    child.stdout.on('data', chunk => output.push(chunk))
    child.once('error', reject)
    child.once('exit', code => {
      if (code === 0) resolve(Buffer.concat(output))
      else reject(new Error(`${command} exited with ${code}`))
    })
  })
}

async function modifiedAt(path) {
  try {
    return (await stat(path)).mtimeMs
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

async function sourceVideos() {
  const characters = await readdir(sourceRoot, { withFileTypes: true })
  const videos = []

  for (const character of characters) {
    if (!character.isDirectory()) continue
    const directory = join(sourceRoot, character.name)
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile() || !videoExtensions.has(extname(entry.name).toLowerCase())) continue
      videos.push({ character: character.name, input: join(directory, entry.name), name: `${parse(entry.name).name}.webm` })
    }
  }

  return videos
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

const keySamplePoints = [
  // Original stable background points on the 720 px square clips.
  { x: 344, y: 36 },
  { x: 24, y: 220 },
  { x: 664, y: 220 },
  // Extra border points. The reading animations draw their magic-circle glow over
  // the original three, so a bare median can lock onto the glow instead of the
  // screen. Sampling widely and keeping only the most green-dominant samples
  // below makes the key robust to props, bubbles, and that glow.
  { x: 24, y: 36 },
  { x: 664, y: 36 },
  { x: 360, y: 80 },
  { x: 24, y: 400 },
  { x: 664, y: 400 },
]

async function averageCrop(input, crop) {
  const pixels = await capture('ffmpeg', [
    '-v', 'error', '-ss', '0.5', '-i', input, '-map', '0:v:0',
    '-vf', `crop=32:32:${crop.x}:${crop.y},format=rgb24`,
    '-frames:v', '1', '-f', 'rawvideo', 'pipe:1',
  ])
  if (pixels.length !== 32 * 32 * 3) {
    throw new Error(`Could not sample a 32 × 32 background region from ${input}`)
  }
  const average = [0, 0, 0]
  for (let offset = 0; offset < pixels.length; offset += 3) {
    average[0] += pixels[offset]
    average[1] += pixels[offset + 1]
    average[2] += pixels[offset + 2]
  }
  return average.map(component => Math.round(component / (32 * 32)))
}

async function backgroundKey(input) {
  const samples = []
  for (const crop of keySamplePoints) {
    try {
      samples.push(await averageCrop(input, crop))
    } catch {
      // A point clipped outside a differently-sized source is simply not sampled.
    }
  }
  if (samples.length === 0) {
    throw new Error(`Could not sample any background region from ${input}`)
  }
  // The pure screen is always the most green-dominant material in frame; glow,
  // shadows, and props rank lower. Keep the greener half and take its per-channel
  // median so one bad sample cannot move the key.
  const ranked = [...samples]
    .map((rgb, index) => ({ rgb, dominance: rgb[1] - Math.max(rgb[0], rgb[2]), index }))
    .sort((a, b) => b.dominance - a.dominance)
  const kept = ranked.slice(0, Math.max(3, Math.ceil(ranked.length / 2)))
  const rgb = [0, 1, 2].map(channel => median(kept.map(sample => sample.rgb[channel])))
  return rgb.map(component => component.toString(16).padStart(2, '0')).join('')
}

function filterFor(background) {
  // Both watermarks sit entirely on the green screen. Remove them before
  // keying. This deliberately has two separate passes: the first is a narrow
  // chroma key around the sampled screen color; the second removes any pixel
  // whose green channel strongly dominates red and blue, where the screen's
  // glow bleeds onto props or wraps the character. The premultiply replaces
  // RGB behind alpha=0 with black: thumbnailers that ignore WebM alpha
  // therefore show black, never the source green.
  return [
    // Keep the published character artifacts at their source resolution. This
    // makes the output reproducible at 720 × 720 regardless of UI seat size.
    `scale=${outputSize}:${outputSize}:flags=lanczos`,
    // Source watermarks scaled from their stable 720 px positions.
    'delogo=x=7:y=7:w=137:h=65',
    'delogo=x=547:y=648:w=166:h=65',
    // Pass 1: conservative background-only chroma key.
    `colorkey=0x${background}:0.11:0.01`,
    'format=rgba',
    // Pass 2: green-dominant spill removal over the whole frame. The reading
    // animations draw their magic-circle glow across the entire screen, and
    // that glow (plus floor shadow below y=510) is green-screen bleed, not
    // effect artwork: neutral table legs and the laptop stay fully opaque.
    "geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(gt(g(X,Y),max(r(X,Y),b(X,Y))*1.35),0,alpha(X,Y))'",
    'premultiply=inplace=1',
    'format=yuva420p',
  ].join(',')
}

const videos = await sourceVideos()
if (videos.length === 0) {
  throw new Error(`No videos found under ${sourceRoot}`)
}

async function processVideo(video) {
  const processedDirectory = join(processedRoot, video.character)
  const characterDirectory = join(characterRoot, video.character)
  const processed = join(processedDirectory, video.name)
  const temporary = `${processed}.tmp.webm`
  const published = join(characterDirectory, video.name)

  await mkdir(processedDirectory, { recursive: true })
  await mkdir(characterDirectory, { recursive: true })
  const [sourceModifiedAt, publishedModifiedAt, processedModifiedAt] = await Promise.all([
    modifiedAt(video.input),
    modifiedAt(published),
    modifiedAt(processed),
  ])
  if (publishedModifiedAt !== undefined && publishedModifiedAt >= sourceModifiedAt) {
    // The published character clip is the canonical artifact. Repair the
    // optional processed mirror without paying the cost of another encode.
    if (processedModifiedAt === undefined || processedModifiedAt < publishedModifiedAt) {
      await copyFile(published, processed)
    }
    console.log(`Skipping ${video.character}/${video.name} (artifact is current)`)
    return false
  }
  await rm(temporary, { force: true })
  const background = await backgroundKey(video.input)
  console.log(`Processing ${video.character}/${video.name} (key #${background})`)
  await run('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', video.input,
    '-map', '0:v:0', '-vf', filterFor(background),
    // VP8 WebM alpha is the broadly supported WebM transparency path. Keep
    // auto-alt-ref off because the alpha stream is incompatible with it.
    '-an', '-c:v', 'libvpx', '-pix_fmt', 'yuva420p',
    '-crf', '18', '-b:v', '0', '-deadline', 'good', '-cpu-used', '4',
    '-auto-alt-ref', '0', temporary,
  ])
  await copyFile(temporary, processed)
  await copyFile(temporary, published)
  await rm(temporary, { force: true })
  return true
}

const results = await Promise.all(videos.map(processVideo))
const processedCount = results.filter(Boolean).length
console.log(`Processed ${processedCount} transparent WebM animation(s); skipped ${videos.length - processedCount} current artifact(s).`)
