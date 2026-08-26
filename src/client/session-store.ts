import { isSnapshot, type Snapshot } from '../protocol.ts'

export class SessionStore {
  private snapshotValue: Snapshot | undefined
  private listeners = new Set<() => void>()
  private eventSource: EventSource | undefined
  private retry: number | undefined
  private retryMs = 1_000
  private raf: number | undefined

  get snapshot(): Snapshot | undefined { return this.snapshotValue }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  start(): void { void this.refresh(); this.connect() }
  stop(): void { this.eventSource?.close(); if (this.retry !== undefined) window.clearTimeout(this.retry); if (this.raf !== undefined) window.cancelAnimationFrame(this.raf) }

  // Coalesce bursts of SSE/fetch updates into one notification per animation
  // frame, so a busy session doesn't re-render the whole office every tick.
  private emit(): void {
    if (this.raf !== undefined) return
    this.raf = window.requestAnimationFrame(() => {
      this.raf = undefined
      for (const listener of this.listeners) listener()
    })
  }
  private adopt(value: unknown): void { if (isSnapshot(value)) { this.snapshotValue = value; this.emit() } }
  private async refresh(): Promise<void> { try { this.adopt(await (await fetch('/dsh-opc/v1/state', { cache: 'no-store' })).json()) } catch {} }
  private connect(): void {
    this.eventSource?.close()
    const source = this.eventSource = new EventSource('/dsh-opc/v1/events')
    source.addEventListener('state', event => { try { this.adopt(JSON.parse((event as MessageEvent<string>).data)); this.retryMs = 1_000 } catch {} })
    source.onerror = () => {
      source.close()
      this.retry = window.setTimeout(() => { void this.refresh(); this.connect() }, this.retryMs)
      this.retryMs = Math.min(15_000, this.retryMs * 2)
    }
  }
}
