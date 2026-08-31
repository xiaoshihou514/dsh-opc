export const API_VERSION = 1 as const;

export type SessionState =
  "idle" | "thinking" | "reading" | "writing" | "await" | "error";

export interface ApprovalView {
  id: string;
  toolName: string;
  reason?: string;
}

export interface ErrorView {
  id: string;
  summary: string;
}

export interface SessionView {
  id: string;
  title: string;
  workspace?: string;
  model: string;
  character: string;
  state: SessionState;
  stateSince: number;
  runningSince?: number;
  activeTool?: string;
  approval?: ApprovalView;
  error?: ErrorView;
  /** True when the session is in the host's archived-session registry set. */
  archived?: boolean;
}

export interface Snapshot {
  apiVersion: typeof API_VERSION;
  revision: number;
  serverTime: number;
  longRunningThresholdsMs: readonly number[];
  sessions: readonly SessionView[];
}

export interface CharacterManifest {
  apiVersion: typeof API_VERSION;
  /** Derived at read time from characters/<name>/<state>-<variant>.webm. */
  characters?: Record<
    string,
    { states: Partial<Record<SessionState, readonly string[]>> }
  >;
  /** The desktop pet's own idle/submit loop, kept separate from session characters. */
  pet?: Partial<Record<"idle" | "submit", readonly string[]>>;
  modelCharacters: Record<string, string>;
  fallbackCharacter: string;
  /** Max mtime (ms) across all asset files; clients use it to bust caches. */
  revision?: number;
}

export const LONG_RUNNING_THRESHOLDS_MS = [5, 10, 20, 30, 45, 60].map(
  (minutes) => minutes * 60_000,
);

export function isSnapshot(value: unknown): value is Snapshot {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<Snapshot>;
  return (
    candidate.apiVersion === API_VERSION &&
    typeof candidate.revision === "number" &&
    typeof candidate.serverTime === "number" &&
    Array.isArray(candidate.sessions)
  );
}

export function characterForModel(
  model: string,
  manifest: CharacterManifest,
): string {
  const exact = manifest.modelCharacters[model];
  if (exact !== undefined) return exact;
  const normalized = model.toLocaleLowerCase();
  return (
    Object.entries(manifest.modelCharacters).find(
      ([candidate]) => candidate.toLocaleLowerCase() === normalized,
    )?.[1] ?? manifest.fallbackCharacter
  );
}
