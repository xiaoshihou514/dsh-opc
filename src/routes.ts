import type { Context } from '@deepseek-ai/cordis'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'
import type { Snapshot } from './protocol.ts'
import { assetCacheDir, serveAsset } from './assets.ts'

export interface SnapshotSource { snapshot(): Snapshot, subscribe(listener: () => void): () => void }

function json(res: import('node:http').ServerResponse, body: unknown): void {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

export function registerRoutes(ctx: Context, webServer: WebServer, source: SnapshotSource): void {
  ctx.effect(() => webServer.register({ kind: 'exact', path: '/dsh-opc/v1/state', handler: (_req, res) => json(res, source.snapshot()) }), 'dsh-opc: state route')
  ctx.effect(() => webServer.register({ kind: 'prefix', path: '/dsh-opc/v1/assets', handler: (req, res) => serveAsset(assetCacheDir(), req, res) }), 'dsh-opc: asset route')
  ctx.effect(() => webServer.register({
    kind: 'exact', path: '/dsh-opc/v1/events', handler: (req, res) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive' })
      const write = (): void => { res.write(`event: state\ndata: ${JSON.stringify(source.snapshot())}\n\n`) }
      write()
      const unsubscribe = source.subscribe(write)
      const heartbeat = setInterval(() => { res.write(': heartbeat\n\n') }, 20_000)
      req.once('close', () => { clearInterval(heartbeat); unsubscribe(); res.end() })
    },
  }), 'dsh-opc: events route')
}
