import { useEffect, useState } from 'react'
import { OfficePanel } from './OfficePanel.tsx'

/** A compact sidebar action; the full office scene belongs in a modal, not the footer slot. */
export function OfficeTrigger({ wide }: { wide: boolean }): JSX.Element {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent): void => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [open])
  return <>
    <button type="button" aria-label="DSH Office" aria-expanded={open} onClick={() => setOpen(true)} style={{
      flex: 'none', display: 'flex', alignItems: 'center', gap: 8, width: wide ? 'calc(100% + 8px)' : 36,
      height: wide ? 34 : 36, margin: wide ? '4px -4px 4px' : '8px 0 10px', padding: wide ? '6px 2px 6px 10px' : 0,
      boxSizing: 'border-box', border: 'none', borderRadius: wide ? 12 : '50%', background: 'transparent',
      color: 'var(--dsw-alias-label-primary)', cursor: 'pointer', overflow: 'hidden', justifyContent: wide ? 'flex-start' : 'center', font: 'inherit', fontSize: 14,
    }}>
      <span aria-hidden="true" style={{ fontSize: wide ? 18 : 20 }}>⌂</span>{wide ? <span>Office</span> : null}
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
