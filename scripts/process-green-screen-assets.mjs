import { copyFile, mkdir, readdir, rm } from 'node:fs/promises'
import { extname, join, parse } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const sourceRoot = fileURLToPath(new URL('../assets/raw/绿幕动画/', import.meta.url))
const processedRoot = fileURLToPath(new URL('../assets/raw/动画/', import.meta.url))
const characterRoot = fileURLToPath(new URL('../assets/characters/', import.meta.url))
const videoExtensions = new Set(['.mp4', '.mov', '.mkv', '.webm'])

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

// Both source watermarks sit entirely on the green screen. The generously
// sized delogo areas remove the marks before keying, while staying clear of
// the actor. colorkey's blend also turns the soft green-tinted floor shadows
// into alpha rather than leaving a green halo around the animation.
const filter = [
  // The supplied source set is 720 × 720. delogo accepts integer geometry,
  // so keep these source-specific rectangles rather than relying on filters'
  // inconsistent expression support across ffmpeg versions.
  'delogo=x=7:y=7:w=137:h=65',
  'delogo=x=547:y=648:w=166:h=65',
  'colorkey=0x55a66a:0.25:0.14',
  'format=yuva420p',
].join(',')

const videos = await sourceVideos()
if (videos.length === 0) {
  throw new Error(`No videos found under ${sourceRoot}`)
}

for (const video of videos) {
  const processedDirectory = join(processedRoot, video.character)
  const characterDirectory = join(characterRoot, video.character)
  const processed = join(processedDirectory, video.name)
  const temporary = `${processed}.tmp.webm`
  const published = join(characterDirectory, video.name)

  await mkdir(processedDirectory, { recursive: true })
  await mkdir(characterDirectory, { recursive: true })
  await rm(temporary, { force: true })
  console.log(`Processing ${video.character}/${video.name}`)
  await run('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', video.input,
    '-map', '0:v:0', '-vf', filter,
    '-an', '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p',
    '-crf', '30', '-b:v', '0', '-deadline', 'good', '-cpu-used', '4',
    '-row-mt', '1', '-auto-alt-ref', '0', temporary,
  ])
  await copyFile(temporary, processed)
  await copyFile(temporary, published)
  await rm(temporary, { force: true })
}

console.log(`Processed ${videos.length} transparent WebM animation(s).`)
