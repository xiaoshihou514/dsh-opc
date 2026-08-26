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

// Only tools whose primary purpose is mutating files are classified as writing.
// Everything else — including reads, image inspection, shell commands, and
// unknown/plugin-provided tools — means the agent is waiting for a result and
// uses the thinking animation. This is safer than treating every new tool as a
// write operation.
const WRITE_TOOLS = new Set([
  "write",
  "edit",
  "str_replace",
  "str_replace_editor",
]);

export function classifyTool(
  name: string,
): "reading" | "writing" | "other" {
  return WRITE_TOOLS.has(name.toLowerCase()) ? "writing" : "other";
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
