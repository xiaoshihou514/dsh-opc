import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

type State = 'thinking' | 'reading' | 'writing' | 'waiting_job' | 'waiting_permission' | 'error'
interface Session { id: string; title: string; model: string; character: string; state: State; stateSince: number; runningSince?: number; activeTool?: string; approval?: { reason?: string }; error?: { summary: string } }
interface Snapshot { sessions: Session[] }
interface Manifest { fallbackCharacter: string; characters: Record<string, { states: Partial<Record<State, string[]>> }> }
const app = document.querySelector<HTMLElement>('#app')!
let manifest: Manifest | undefined
const priority: Record<State, number> = { waiting_permission: 0, error: 1, writing: 2, reading: 3, thinking: 4, waiting_job: 5 }
const select = (sessions: Session[]): Session | undefined => [...sessions].sort((a, b) => priority[a.state] - priority[b.state] || a.stateSince - b.stateSince)[0]
const label: Record<State, string> = { thinking: 'Thinking', reading: 'Reading', writing: 'Writing', waiting_job: 'Waiting for work', waiting_permission: 'Permission needed', error: 'Needs attention' }
function render(snapshot: Snapshot): void {
  const session = select(snapshot.sessions)
  if (session === undefined) { app.innerHTML = '<section class="pet"><div class="fallback">◉</div><strong>Office is quiet</strong><small>Waiting for a DSH session</small></section>'; return }
  const files = manifest?.characters[session.character]?.states[session.state] ?? manifest?.characters[manifest?.fallbackCharacter ?? '']?.states[session.state] ?? [`${session.state}-0.webm`]
  const src = `/dsh-opc/v1/assets/characters/${encodeURIComponent(session.character)}/${encodeURIComponent(files[Math.floor(Math.random() * files.length)] ?? `${session.state}-0.webm`)}`
  const detail = session.error?.summary ?? session.approval?.reason ?? session.activeTool ?? session.model
  app.innerHTML = `<section class="pet ${session.state}"><video autoplay muted loop playsinline src="${src}"></video><div class="fallback" hidden>◉</div><strong>${escape(session.title)}</strong><span>${label[session.state]}</span><small>${escape(detail)}</small><button id="open">Open DSH</button></section>`
  const video = app.querySelector('video')!; video.addEventListener('error', () => { video.hidden = true; app.querySelector<HTMLElement>('.fallback')!.hidden = false })
  app.querySelector('#open')?.addEventListener('click', () => { void invoke('open_dsh') })
}
function escape(value: string): string { const element = document.createElement('span'); element.textContent = value; return element.innerHTML }
void listen<Snapshot>('opc:snapshot', event => render(event.payload))
void invoke<Manifest>('manifest').then(value => { manifest = value }).catch(() => {})
void invoke<Snapshot>('snapshot').then(render).catch(() => render({ sessions: [] }))
