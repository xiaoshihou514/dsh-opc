import { describe, expect, it } from "vitest";
import {
  classifyTool,
  stateOf,
  type SessionFacts,
} from "../src/state-machine.ts";

const base: SessionFacts = {
  id: "s",
  title: "s",
  model: "model",
  character: "fallback",
  running: true,
  stateSince: 0,
};

describe("office state machine", () => {
  it("uses the documented state priority", () => {
    expect(
      stateOf({
        ...base,
        activeTool: "edit",
        error: { id: "e", summary: "bad" },
        approval: { id: "a", toolName: "bash" },
      }),
    ).toBe("await");
    expect(
      stateOf({
        ...base,
        activeTool: "edit",
        error: { id: "e", summary: "bad" },
      }),
    ).toBe("error");
    expect(stateOf({ ...base, activeTool: "read" })).toBe("reading");
    expect(stateOf({ ...base, activeTool: "edit" })).toBe("writing");
    expect(stateOf(base)).toBe("thinking");
    expect(stateOf({ ...base, running: false })).toBe("idle");
  });
  it("classifies unknown tools conservatively as writing", () => {
    expect(classifyTool("grep")).toBe("reading");
    expect(classifyTool("unfamiliar_tool")).toBe("writing");
  });
});
