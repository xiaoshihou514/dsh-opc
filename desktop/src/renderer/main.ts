import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

type State = 'idle' | 'thinking' | 'reading' | 'writing' | 'await' | 'error'
type PetState = 'idle' | 'submit'
interface Session {
  id: string
  title: string
  model: string
  character: string
  state: State
  stateSince: number
  runningSince?: number
  activeTool?: string
  approval?: { toolName?: string; reason?: string }
  error?: { summary: string }
}
interface Snapshot { serverTime: number; sessions: Session[] }
interface Manifest {
  fallbackCharacter: string
  characters?: Record<string, { states: Partial<Record<string, string[]>> }>
  pet?: Partial<Record<'idle' | 'submit', string[]>>
}

const app = document.querySelector<HTMLElement>('#app')!
let manifest: Manifest | undefined
let baseUrl = 'http://127.0.0.1:3080'
let lastSnapshotAt = 0
let prev = new Map<string, State>()
let currentPet: PetState = 'idle'
let currentSrc = ''

const LONG_MS = [5, 10, 20, 40, 80, 160].map((m) => m * 60_000)
interface TvEvent {
  kind: 'permission' | 'error' | 'longrunning' | 'ready'
  sessionId: string
  color: string
  text: string
  priority: number
}

function escape(value: string): string {
  const element = document.createElement('span')
  element.textContent = value
  return element.innerHTML
}
function petFiles(state: PetState): string[] {
  return manifest?.pet?.[state] ?? []
}
function pick(state: PetState): string {
  const files = petFiles(state)
  const chosen = files[Math.floor(Math.random() * files.length)]
  const base = baseUrl.replace(/\/$/, "")
  const name = chosen === undefined ? `${state}-0.webm` : chosen
  return `${base}/dsh-opc/v1/assets/pet/${encodeURIComponent(name)}`
}

/** Highest-priority thing that needs the user's attention right now. */
function detectEvent(sessions: Session[]): TvEvent | undefined {
  let best: TvEvent | undefined
  const consider = (e: TvEvent): void => {
    if (best === undefined || e.priority < best.priority) best = e
  }
  for (const s of sessions) {
    if (s.approval)
      consider({
        kind: 'permission', sessionId: s.id, color: '#c8931f',
        text: `${s.title} 请求授权：${s.approval.toolName ?? '工具'}`, priority: 0,
      })
    if (s.error)
      consider({
        kind: 'error', sessionId: s.id, color: '#ad3f3a',
        text: `${s.title} 出错：${s.error.summary}`, priority: 1,
      })
    if (s.state !== 'idle' && s.runningSince !== undefined) {
      const elapsed = Date.now() - s.runningSince
      const reached = LONG_MS.filter((m) => elapsed >= m).pop()
      if (reached !== undefined)
        consider({
          kind: 'longrunning', sessionId: s.id, color: '#39619f',
          text: `${s.title} 已运行 ${Math.floor(elapsed / 60_000)} 分钟`, priority: 2,
        })
    }
  }
  if (best === undefined) {
    for (const s of sessions) {
      const p = prev.get(s.id)
      if (p !== undefined && p !== 'idle' && s.state === 'idle')
        consider({
          kind: 'ready', sessionId: s.id, color: '#3d8a58',
          text: `${s.title} 上一轮已完成`, priority: 3,
        })
    }
  }
  return best
}

function tvHtml(e: TvEvent): string {
  return `<div id="tv-notice" class="tv" data-kind="${e.kind}" style="--tv-color:${e.color}">
    <div class="tv-screen"><div class="tv-scan"></div><span class="tv-text">${escape(e.text)}</span></div>
    <div class="tv-base"></div>
  </div>`
}

function render(snapshot: Snapshot): void {
  lastSnapshotAt = Date.now()
  const sessions = snapshot.sessions ?? []
  const active = sessions.some((s) => s.state !== 'idle')
  const pet: PetState = active ? 'submit' : 'idle'
  if (pet !== currentPet) {
    currentPet = pet
    currentSrc = pick(pet)
  }
  const event = detectEvent(sessions)
  app.innerHTML = `
    <section class="pet ${currentPet}">
      <video autoplay muted loop playsinline src="${currentSrc}"></video>
      <div class="fallback" hidden>◉</div>
    </section>
    ${event === undefined ? '' : tvHtml(event)}
  `
  const video = app.querySelector('video')
  if (video !== null)
    video.addEventListener('error', () => {
      video.hidden = true
      app.querySelector<HTMLElement>('.fallback')!.hidden = false
    })
  if (event !== undefined)
    app.querySelector('#tv-notice')?.addEventListener('click', () => {
      void invoke('open_session', { sessionId: event.sessionId })
    })
  // Track running→idle flips for the "上一轮已完成" notice.
  for (const s of sessions) prev.set(s.id, s.state)
  for (const id of [...prev.keys()]) if (!sessions.some((s) => s.id === id)) prev.delete(id)
}

// If DSH stops answering (or never connects), fall back to the idle pet.
setInterval(() => {
  if (Date.now() - lastSnapshotAt > 15_000 && currentPet !== 'idle') {
    currentPet = 'idle'
    currentSrc = pick('idle')
    render({ serverTime: Date.now(), sessions: [] })
  }
}, 5_000)

void listen<Snapshot>('opc:snapshot', (event) => render(event.payload))
void invoke<string>('base_url')
  .then((value) => {
    baseUrl = value.trim().replace(/\/$/, '')
    if (currentSrc !== '') currentSrc = pick(currentPet)
  })
  .catch(() => {})
void invoke<Manifest>('manifest')
  .then((value) => {
    manifest = value
    currentSrc = currentSrc === '' ? pick('idle') : currentSrc
  })
  .catch(() => {})
void invoke<Snapshot>('snapshot')
  .then(render)
  .catch(() => render({ serverTime: Date.now(), sessions: [] }))
