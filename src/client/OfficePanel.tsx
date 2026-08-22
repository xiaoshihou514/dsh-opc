import { useEffect, useState } from 'react'
import type { CharacterManifest, SessionState, SessionView } from '../protocol.ts'
import { SessionStore } from './session-store.ts'

// Browser plugins are loaded as one dynamic JS bundle, so keep essential scene
// styling in the bundle instead of assuming the host will discover a sibling CSS file.
const OFFICE_CSS = `.opc-office{color:#ececf0;background:#1d1e23;border:1px solid #3d3e44;border-radius:12px;overflow:hidden;min-width:320px}.opc-office header{display:flex;justify-content:space-between;padding:14px 16px;background:linear-gradient(120deg,#322852,#172c42)}.opc-office h2,.opc-office p{margin:0}.opc-office h2{font-size:15px}.opc-office p,.opc-revision{color:#b9b9c3;font-size:12px}.opc-floor{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:12px;padding:14px;background:#181920}.opc-worker{position:relative;min-height:174px;padding:7px;text-align:center;border:1px solid #ffffff12;border-radius:9px;background:#17181ddd}.opc-monitor{display:flex;flex-direction:column;min-height:32px;overflow:hidden;color:#c4ecff;background:#263546;border-radius:4px;font-size:11px}.opc-monitor span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.opc-monitor small,.opc-worker>small{color:#b8bac3;font-size:11px}.opc-video,.opc-fallback{display:block;width:100%;height:96px;object-fit:contain}.opc-fallback{padding-top:25px;font-size:44px;color:#92c5d7}.opc-worker strong{display:block;font-size:12px}.opc-attention{position:absolute;top:-6px;right:-4px;display:grid;place-items:center;width:20px;height:20px;border-radius:50%;color:#fff;background:#db554d;font-weight:800}.opc-waiting_permission{border-color:#e7a64b}.opc-error{border-color:#df665d}.opc-empty{grid-column:1/-1;padding:30px 0;text-align:center}`
function ensureStyle(): void { if (document.querySelector('#dsh-opc-style') !== null) return; const style = document.createElement('style'); style.id = 'dsh-opc-style'; style.textContent = OFFICE_CSS; document.head.append(style) }

const LABELS: Record<SessionState, string> = {
  thinking: 'Thinking', reading: 'Reading', writing: 'Writing', waiting_job: 'Waiting for work', waiting_permission: 'Needs permission', error: 'Error',
}

function animationUrl(session: SessionView, manifest: CharacterManifest | undefined): string {
  const files = manifest?.characters[session.character]?.states[session.state] ?? manifest?.characters[manifest?.fallbackCharacter ?? '']?.states[session.state] ?? []
  const selected = files[Math.floor(Math.random() * files.length)] ?? `${session.state}-0.webm`
  return `/dsh-opc/v1/assets/characters/${encodeURIComponent(session.character)}/${encodeURIComponent(selected)}`
}

function Worker({ session, manifest }: { session: SessionView, manifest: CharacterManifest | undefined }) {
  const [failed, setFailed] = useState(false)
  const [source, setSource] = useState(() => animationUrl(session, manifest))
  useEffect(() => { setFailed(false); setSource(animationUrl(session, manifest)) }, [session.id, session.state, session.stateSince, manifest])
  const attention = session.state === 'waiting_permission' || session.state === 'error'
  return <article className={`opc-worker opc-${session.state}`} aria-label={`${session.title}: ${LABELS[session.state]}`}>
    <div className="opc-monitor"><span>{session.title}</span><small>{session.model}</small></div>
    {failed
      ? <div className="opc-fallback" role="img" aria-label="Character animation unavailable">◉</div>
      : <video className="opc-video" src={source} muted playsInline autoPlay loop onError={() => setFailed(true)} />}
    <strong>{LABELS[session.state]}</strong>
    {session.activeTool !== undefined ? <small>{session.activeTool}</small> : null}
    {attention ? <span className="opc-attention">!</span> : null}
  </article>
}

export function OfficePanel(): JSX.Element {
  ensureStyle()
  const [store] = useState(() => new SessionStore())
  const [snapshot, setSnapshot] = useState(store.snapshot)
  const [manifest, setManifest] = useState<CharacterManifest>()
  useEffect(() => { const stop = store.subscribe(() => setSnapshot(store.snapshot)); store.start(); return () => { stop(); store.stop() } }, [store])
  useEffect(() => { void fetch('/dsh-opc/v1/assets/manifest.json').then(response => response.json()).then(setManifest).catch(() => {}) }, [])
  const sessions = snapshot?.sessions ?? []
  return <section className="opc-office">
    <header><div><h2>DSH Office</h2><p>{sessions.length} active session{sessions.length === 1 ? '' : 's'}</p></div><span className="opc-revision">{snapshot === undefined ? 'Connecting…' : `#${snapshot.revision}`}</span></header>
    <div className="opc-floor">{sessions.length === 0 ? <p className="opc-empty">No live sessions. The office is ready for the next job.</p> : sessions.map(session => <Worker key={session.id} session={session} manifest={manifest} />)}</div>
  </section>
}
