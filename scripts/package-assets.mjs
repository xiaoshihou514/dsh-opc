import { spawn } from 'node:child_process'
import { rm } from 'node:fs/promises'

const output = new URL('../dsh-opc-assets.tar.gz', import.meta.url)
await rm(output, { force: true })
await new Promise((resolve, reject) => {
  const child = spawn('tar', ['--exclude=raw', '-czf', output.pathname, '-C', new URL('../assets/', import.meta.url).pathname, 'manifest.json', 'office-night.png', 'office-morning.png', 'office-noon.png', 'office-afternoon.png', 'office-evening.png', 'characters'], { stdio: 'inherit' })
  child.once('exit', code => code === 0 ? resolve() : reject(new Error(`tar exited ${code}`)))
})
