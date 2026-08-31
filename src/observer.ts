import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type {} from "@deepseek-ai/dsh-host-webserver";
import type {} from "@deepseek-ai/dsh-tools";
import type {} from "@deepseek-ai/dsh-user-approval";
import {
  API_VERSION,
  LONG_RUNNING_THRESHOLDS_MS,
  type Snapshot,
} from "./protocol.ts";
import { characterForModel, type CharacterManifest } from "./protocol.ts";
import { project, type SessionFacts } from "./state-machine.ts";
import { registerRoutes } from "./routes.ts";
import {
  activeAssetDir,
  assetStatus,
  readManifest,
} from "./assets.ts";

export const name = "dsh-opc-observer";
export const inject = ["agents", "webServer", "workspaceRegistry"];

/** Registry-global archived-session ids, read from the host workspace service.
 *  Guarded against an uninitialised registry state (archivedSessionIds getter
 *  requires the storage state) so snapshot construction never throws. */
function archivedIdsOf(ctx: Context): ReadonlySet<string> {
  try {
    const registry = (
      ctx as unknown as {
        workspaceRegistry?: { archivedSessionIds?: readonly string[] };
      }
    ).workspaceRegistry;
    return new Set(registry?.archivedSessionIds ?? []);
  } catch {
    return new Set();
  }
}

const DEFAULT_MANIFEST: CharacterManifest = {
  apiVersion: API_VERSION,
  characters: { fallback: { states: {} } },
  modelCharacters: {},
  fallbackCharacter: "fallback",
};

export function apply(ctx: Context): void {
  let revision = 0;
  let manifest = DEFAULT_MANIFEST;
  let assetDownload: {
    state: "local" | "idle" | "downloading" | "complete" | "error";
    received: number;
    total: number;
    error?: string;
  } = { state: "idle", received: 0, total: 0 };
  const sessions = new Map<string, SessionFacts>();
  const listeners = new Set<() => void>();
  const publish = (): void => {
    revision += 1;
    for (const listener of listeners) listener();
  };
  const lookup = (agent: Agent): SessionFacts | undefined =>
    sessions.get(agent.id);
  const titleOf = (agent: Agent): string => String(agent.id);
  const makeFacts = (agent: Agent): SessionFacts => ({
    id: agent.id,
    title: titleOf(agent),
    model: agent.options.model ?? "default",
    character: characterForModel(agent.options.model ?? "default", manifest),
    running: agent.status === "running",
    stateSince: Date.now(),
    ...(agent.session.header.cwd === undefined
      ? {}
      : { workspace: agent.session.header.cwd }),
    ...(agent.status === "running" ? { runningSince: Date.now() } : {}),
  });
  const refreshAssets = async (): Promise<void> => {
    manifest = (await readManifest(await activeAssetDir())) ?? manifest;
    for (const facts of sessions.values())
      facts.character = characterForModel(facts.model, manifest);
    publish();
  };
  // Assets are local-only: read the checkout manifest once at startup.
  const loadAssets = async (): Promise<void> => {
    assetDownload = { state: "local", received: 0, total: 0 };
    await refreshAssets();
  };
  const source = {
    snapshot: (): Snapshot => ({
      apiVersion: API_VERSION,
      revision,
      serverTime: Date.now(),
      longRunningThresholdsMs: LONG_RUNNING_THRESHOLDS_MS,
      sessions: [...sessions.values()].map((facts) =>
        project(facts, archivedIdsOf(ctx)),
      ),
    }),
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    assetsUpdated: refreshAssets,
    assetStatus: async () => ({
      apiVersion: API_VERSION,
      ...(await assetStatus()),
      ...assetDownload,
    }),
  };
  for (const agent of ctx.agents.list())
    sessions.set(agent.id, makeFacts(agent));
  registerRoutes(ctx, ctx.webServer, source);
  // All animation assets come from the plugin's own assets/ directory.
  void loadAssets();
  ctx.effect(
    () =>
      ctx.on("agent/created", ({ agent }) => {
        sessions.set(agent.id, makeFacts(agent));
        publish();
      }),
    "dsh-opc: agent created",
  );
  ctx.effect(
    () =>
      ctx.on("agent/disposed", ({ agent }) => {
        sessions.delete(agent.id);
        publish();
      }),
    "dsh-opc: agent disposed",
  );
  ctx.effect(
    () =>
      ctx.on("agent/status", ({ agent, status }) => {
        const facts = lookup(agent);
        if (facts === undefined) return;
        facts.running = status === "running";
        facts.stateSince = Date.now();
        if (facts.running) {
          facts.runningSince = Date.now();
          delete facts.error;
        } else {
          delete facts.runningSince;
          delete facts.activeTool;
        }
        publish();
      }),
    "dsh-opc: agent status",
  );
  ctx.effect(
    () =>
      ctx.on("agent/request-error", async (request, next) => {
        const action = await next();
        const facts = lookup(request.agent);
        if (facts !== undefined) {
          // A recovery owner explicitly retried the request; only terminal failures
          // deserve the office error animation and a desktop notification. A retry
          // means the session recovered, so clear any held error.
          if (action?.kind !== "retry") {
            facts.error = {
              id: `${request.turn}:${request.step}:${request.failure.code}`,
              summary: request.failure.message,
            };
          } else {
            delete facts.error;
          }
          facts.stateSince = Date.now();
          publish();
        }
        return action;
      }),
    "dsh-opc: request error observer",
  );
  ctx.effect(
    () =>
      ctx.on("approval/request", async (request, next) => {
        const facts = lookup(request.agent);
        if (facts === undefined) return await next();
        const approval = {
          id: `${request.callId ?? ""}:${request.toolName}:${Date.now()}`,
          toolName: request.toolName,
          ...(request.reason === undefined ? {} : { reason: request.reason }),
        };
        facts.approval = approval;
        facts.stateSince = Date.now();
        publish();
        try {
          return await next();
        } finally {
          if (facts.approval?.id === approval.id) {
            delete facts.approval;
            facts.stateSince = Date.now();
            publish();
          }
        }
      }),
    "dsh-opc: approval observer",
  );
  ctx.effect(
    () =>
      ctx.on("tools/execute", async (execution, next) => {
        const facts =
          execution.agent === undefined
            ? undefined
            : sessions.get(execution.agent.id);
        if (facts === undefined) return await next();
        facts.activeTool = execution.name;
        facts.stateSince = Date.now();
        publish();
        try {
          const result = await next();
          if (result.isError)
            facts.error = {
              id: `${execution.callId}:${Date.now()}`,
              summary: result.error.message,
            };
          else delete facts.error;
          return result;
        } catch (error) {
          facts.error = {
            id: `${execution.callId}:${Date.now()}`,
            summary: error instanceof Error ? error.message : "Tool failed",
          };
          throw error;
        } finally {
          delete facts.activeTool;
          facts.stateSince = Date.now();
          publish();
        }
      }),
    "dsh-opc: tool observer",
  );
}
