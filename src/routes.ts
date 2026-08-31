import type { Context } from "@deepseek-ai/cordis";
import type { WebServer } from "@deepseek-ai/dsh-host-webserver";
import type { Snapshot } from "./protocol.ts";
import { activeAssetDir, serveAsset } from "./assets.ts";

export interface SnapshotSource {
  snapshot(): Snapshot;
  subscribe(listener: () => void): () => void;
  assetsUpdated?(): Promise<void>;
  assetStatus?(): Promise<unknown>;
}

function json(res: import("node:http").ServerResponse, body: unknown): void {
  res.writeHead(200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

export function registerRoutes(
  ctx: Context,
  webServer: WebServer,
  source: SnapshotSource,
): void {
  for (const path of ["/office-test", "/:/office-test"]) {
    ctx.effect(
      () =>
        webServer.register({
          kind: "exact",
          path,
          handler: (req, res) => {
            if (req.method !== "GET") {
              res.writeHead(405).end();
              return;
            }
            // The built-in SPA only serves registered shell paths. Enter it
            // through root, then the client restores this invisible test URL.
            res.writeHead(302, { location: "/?office-test=1" }).end();
          },
        }),
      `dsh-opc: office test page route ${path}`,
    );
  }
  // The office is a first-class path too: /office redirects into the shell so
  // the client can render the office panel as its own page.
  for (const path of ["/office", "/:/office"]) {
    ctx.effect(
      () =>
        webServer.register({
          kind: "exact",
          path,
          handler: (req, res) => {
            if (req.method !== "GET") {
              res.writeHead(405).end();
              return;
            }
            res.writeHead(302, { location: "/?office=1" }).end();
          },
        }),
      `dsh-opc: office page route ${path}`,
    );
  }
  ctx.effect(
    () =>
      webServer.register({
        kind: "exact",
        path: "/dsh-opc/v1/state",
        handler: (_req, res) => json(res, source.snapshot()),
      }),
    "dsh-opc: state route",
  );
  ctx.effect(
    () =>
      webServer.register({
        kind: "exact",
        path: "/dsh-opc/v1/assets/status",
        handler: async (req, res) => {
          if (req.method !== "GET") {
            res.writeHead(405).end();
            return;
          }
          json(
            res,
            (await source.assetStatus?.()) ?? {
              apiVersion: 1,
              installed: false,
              localDev: false,
            },
          );
        },
      }),
    "dsh-opc: asset status route",
  );
  ctx.effect(
    () =>
      webServer.register({
        kind: "exact",
        path: "/dsh-opc/v1/assets/download",
        handler: async (req, res) => {
          if (req.method !== "POST") {
            res.writeHead(405).end();
            return;
          }
          // An automatic initial download can be retried after a network failure.
          await source.assetsUpdated?.();
          json(res, (await source.assetStatus?.()) ?? { apiVersion: 1 });
        },
      }),
    "dsh-opc: asset download route",
  );
  ctx.effect(
    () =>
      webServer.register({
        kind: "prefix",
        path: "/dsh-opc/v1/assets",
        handler: async (req, res) => {
          // Clips/backgrounds are immutable; the manifest always revalidates
          // (serveAsset) and carries the revision that busts the former.
          await serveAsset(
            await activeAssetDir(),
            req,
            res,
            "public, max-age=31536000, immutable",
          );
        },
      }),
    "dsh-opc: asset route",
  );
  ctx.effect(
    () =>
      webServer.register({
        kind: "exact",
        path: "/dsh-opc/v1/events",
        handler: (req, res) => {
          if (req.method !== "GET") {
            res.writeHead(405).end();
            return;
          }
          res.writeHead(200, {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
          });
          const write = (): void => {
            res.write(
              `event: state\ndata: ${JSON.stringify(source.snapshot())}\n\n`,
            );
          };
          write();
          const unsubscribe = source.subscribe(write);
          const heartbeat = setInterval(() => {
            res.write(": heartbeat\n\n");
          }, 20_000);
          req.once("close", () => {
            clearInterval(heartbeat);
            unsubscribe();
            res.end();
          });
        },
      }),
    "dsh-opc: events route",
  );
}
