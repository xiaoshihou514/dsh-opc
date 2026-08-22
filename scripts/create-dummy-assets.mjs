import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const root = new URL('../assets/characters/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('../assets/manifest.json', import.meta.url), 'utf8'))
const states = ['thinking', 'reading', 'writing', 'waiting_job', 'waiting_permission', 'error']
const colors = { thinking: '4169e1', reading: '377f6e', writing: 'a65d2e', waiting_job: '555b68', waiting_permission: 'bd8d25', error: 'a94442' }

function run(command, args) { return new Promise((resolve, reject) => { const child = spawn(command, args, { stdio: 'inherit' }); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`))) }) }
for (const character of Object.keys(manifest.characters)) {
  await mkdir(new URL(`${character}/`, root), { recursive: true })
  for (const state of states) for (const variant of [0, 1]) {
    const file = join(root.pathname, character, `${state}-${variant}.webm`)
    // 1 s color-card clips are deliberately disposable development stand-ins.
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x${colors[state]}:s=160x160:d=1`, '-vf', `drawtext=text='${character} ${state} ${variant}':fontcolor=white:fontsize=13:x=8:y=72`, '-an', '-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0', file])
  }
}
await writeFile(new URL('../assets/.dummy-assets', import.meta.url), 'Generated locally; release art replaces these files.\n')
