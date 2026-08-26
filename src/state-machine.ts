import type {
  ApprovalView,
  ErrorView,
  SessionState,
  SessionView,
} from "./protocol.ts";

export interface SessionFacts {
  id: string;
  title: string;
  workspace?: string;
  model: string;
  character: string;
  running: boolean;
  runningSince?: number;
  activeTool?: string;
  approval?: ApprovalView;
  error?: ErrorView;
  stateSince: number;
}

const READ_TOOLS = new Set([
  "read",
  "glob",
  "grep",
  "search",
  "webfetch",
  "browse",
  "fetch",
  "list",
  "ls",
]);

// Tools that run and wait for a result (bash, jobs, commands…). While one of
// these is active the agent is waiting, not writing — so the office shows the
// thinking animation rather than "writing".
const EXEC_TOOLS = new Set([
  "bash",
  "job_output",
  "job",
  "run",
  "exec",
  "execute",
  "command",
  "task",
  "build",
  "install",
  "npm",
  "pnpm",
  "cargo",
  "script",
  "shell",
]);

export function classifyTool(
  name: string,
): "reading" | "writing" | "other" {
  const lower = name.toLowerCase();
  if (READ_TOOLS.has(lower)) return "reading";
  if (EXEC_TOOLS.has(lower)) return "other";
  return "writing";
}

export function stateOf(facts: SessionFacts): SessionState {
  if (facts.approval !== undefined) return "await";
  if (facts.error !== undefined) return "error";
  if (facts.activeTool !== undefined) {
    const kind = classifyTool(facts.activeTool);
    if (kind === "reading") return "reading";
    if (kind === "writing") return "writing";
    // "other" (exec/wait) falls through to the running/thinking branch.
  }
  return facts.running ? "thinking" : "idle";
}

export function project(
  facts: SessionFacts,
  archivedIds?: ReadonlySet<string>,
): SessionView {
  const state = stateOf(facts);
  return {
    id: facts.id,
    title: facts.title,
    model: facts.model,
    character: facts.character,
    state,
    stateSince: facts.stateSince,
    ...(archivedIds?.has(facts.id) ? { archived: true } : {}),
    ...(facts.workspace === undefined ? {} : { workspace: facts.workspace }),
    ...(facts.runningSince === undefined
      ? {}
      : { runningSince: facts.runningSince }),
    ...(facts.activeTool === undefined ? {} : { activeTool: facts.activeTool }),
    ...(facts.approval === undefined ? {} : { approval: facts.approval }),
    ...(facts.error === undefined ? {} : { error: facts.error }),
  };
}
