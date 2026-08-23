import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

type State = 'idle' | 'thinking' | 'reading' | 'writing' | 'await' | 'error'
interface Session { id: string; title: string; model: string; character: string; state: State; stateSince: number; runningSince?: number; activeTool?: string; approval?: { reason?: string }; error?: { summary: string } }
interface Snapshot { sessions: Session[] }
interface Manifest { fallbackCharacter: string; characters?: Record<string, { states: Partial<Record<State, string[]>> }> }
const app = document.querySelector<HTMLElement>('#app')!
let manifest: Manifest | undefined
const priority: Record<State, number> = { await: 0, error: 1, writing: 2, reading: 3, thinking: 4, idle: 5 }
const select = (sessions: Session[]): Session | undefined => [...sessions].sort((a, b) => priority[a.state] - priority[b.state] || a.stateSince - b.stateSince)[0]
const label: Record<State, string> = { idle: '待命中', thinking: '思考中', reading: '阅读中', writing: '编写中', await: '等待授权', error: '需要处理' }
function render(snapshot: Snapshot): void {
  const session = select(snapshot.sessions)
  if (session === undefined) { app.innerHTML = '<section class="pet"><div class="fallback">◉</div><strong>办公室很安静</strong><small>正在等待 DSH 会话</small></section>'; return }
  const files = manifest?.characters?.[session.character]?.states[session.state] ?? manifest?.characters?.[manifest?.fallbackCharacter ?? '']?.states[session.state] ?? [`${session.state}-0.webm`]
  const src = `/dsh-opc/v1/assets/characters/${encodeURIComponent(session.character)}/${encodeURIComponent(files[Math.floor(Math.random() * files.length)] ?? `${session.state}-0.webm`)}`
  const detail = session.error?.summary ?? session.approval?.reason ?? session.activeTool ?? session.model
  app.innerHTML = `<section class="pet ${session.state}"><video autoplay muted loop playsinline src="${src}"></video><div class="fallback" hidden>◉</div><strong>${escape(session.title)}</strong><span>${label[session.state]}</span><small>${escape(detail)}</small><button id="open">打开 DSH</button></section>`
  const video = app.querySelector('video')!; video.addEventListener('error', () => { video.hidden = true; app.querySelector<HTMLElement>('.fallback')!.hidden = false })
  app.querySelector('#open')?.addEventListener('click', () => { void invoke('open_dsh') })
}
function escape(value: string): string { const element = document.createElement('span'); element.textContent = value; return element.innerHTML }
void listen<Snapshot>('opc:snapshot', event => render(event.payload))
void invoke<Manifest>('manifest').then(value => { manifest = value }).catch(() => {})
void invoke<Snapshot>('snapshot').then(render).catch(() => render({ sessions: [] }))
