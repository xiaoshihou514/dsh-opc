import { useEffect, useState } from 'react'
import { OfficePanel } from './OfficePanel.tsx'

/** A shell-level launcher; the office scene itself stays in a modal. */
export function OfficeTrigger(): JSX.Element {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent): void => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [open])
  return <>
    <button type="button" aria-label="Open DSH Office" aria-expanded={open} onClick={() => setOpen(true)} style={{
      position: 'fixed', top: 76, right: 20, zIndex: 30, display: 'flex', alignItems: 'center', gap: 8,
      height: 38, padding: '0 13px 0 11px', boxSizing: 'border-box', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 19,
      background: 'var(--dsw-alias-button-floating-fill)', boxShadow: '0 4px 16px #0003', color: 'var(--dsw-alias-label-primary)',
      cursor: 'pointer', font: 'inherit', fontSize: 14,
    }}>
      <span aria-hidden="true" style={{ fontSize: 18 }}>⌂</span><span>Office</span>
    </button>
    {open ? <div role="dialog" aria-modal="true" aria-label="DSH Office" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--dsw-alias-bg-mask-1)', backdropFilter: 'var(--dsw-mask-blur)' }} onClick={() => setOpen(false)} />
      <div style={{ position: 'relative', width: 'min(960px, calc(100vw - 48px))', maxHeight: 'calc(100vh - 48px)', overflow: 'auto' }}>
        <button type="button" aria-label="Close office" onClick={() => setOpen(false)} style={{ position: 'absolute', zIndex: 1, top: 10, right: 10, width: 30, height: 30, border: 0, borderRadius: 15, color: '#fff', background: '#0008', cursor: 'pointer' }}>×</button>
        <OfficePanel />
      </div>
    </div> : null}
  </>
}
