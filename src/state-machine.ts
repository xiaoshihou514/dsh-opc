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

export function classifyTool(name: string): "reading" | "writing" {
  return READ_TOOLS.has(name.toLowerCase()) ? "reading" : "writing";
}

export function stateOf(facts: SessionFacts): SessionState {
  if (facts.approval !== undefined) return "await";
  if (facts.error !== undefined) return "error";
  if (facts.activeTool !== undefined) return classifyTool(facts.activeTool);
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
