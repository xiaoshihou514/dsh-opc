export const API_VERSION = 1 as const

export type SessionState = 'thinking' | 'reading' | 'writing' | 'waiting_job' | 'waiting_permission' | 'error'

export interface ApprovalView {
  id: string
  toolName: string
  reason?: string
}

export interface ErrorView {
  id: string
  summary: string
}

export interface SessionView {
  id: string
  title: string
  workspace?: string
  model: string
  character: string
  state: SessionState
  stateSince: number
  runningSince?: number
  activeTool?: string
  approval?: ApprovalView
  error?: ErrorView
}

export interface Snapshot {
  apiVersion: typeof API_VERSION
  revision: number
  serverTime: number
  longRunningThresholdsMs: readonly number[]
  sessions: readonly SessionView[]
}

export interface CharacterManifest {
  apiVersion: typeof API_VERSION
  characters: Record<string, { states: Partial<Record<SessionState, readonly string[]>> }>
  modelCharacters: Record<string, string>
  fallbackCharacter: string
}

export const LONG_RUNNING_THRESHOLDS_MS = [5, 10, 20, 30, 45, 60].map(minutes => minutes * 60_000)

export function isSnapshot(value: unknown): value is Snapshot {
  if (value === null || typeof value !== 'object') return false
  const candidate = value as Partial<Snapshot>
  return candidate.apiVersion === API_VERSION && typeof candidate.revision === 'number'
    && typeof candidate.serverTime === 'number' && Array.isArray(candidate.sessions)
}

export function characterForModel(model: string, manifest: CharacterManifest): string {
  return manifest.modelCharacters[model] ?? manifest.fallbackCharacter
}
