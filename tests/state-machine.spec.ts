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
    // Only file mutations show the writing animation.
    expect(stateOf({ ...base, activeTool: "edit" })).toBe("writing");
    expect(stateOf({ ...base, activeTool: "write" })).toBe("writing");
    expect(stateOf({ ...base, activeTool: "str_replace_editor" })).toBe(
      "writing",
    );
    // Reads, image inspection, shell commands, and unknown tools show thinking.
    expect(stateOf({ ...base, activeTool: "read" })).toBe("thinking");
    expect(stateOf({ ...base, activeTool: "view_image" })).toBe("thinking");
    expect(stateOf({ ...base, activeTool: "bash" })).toBe("thinking");
    expect(stateOf({ ...base, activeTool: "job_output" })).toBe("thinking");
    expect(stateOf(base)).toBe("thinking");
    expect(stateOf({ ...base, running: false })).toBe("idle");
  });
  it("classifies only file mutations as writing", () => {
    expect(classifyTool("write")).toBe("writing");
    expect(classifyTool("edit")).toBe("writing");
    expect(classifyTool("str_replace")).toBe("writing");
    expect(classifyTool("str_replace_editor")).toBe("writing");
    expect(classifyTool("grep")).toBe("other");
    expect(classifyTool("read_image")).toBe("other");
    expect(classifyTool("view_image")).toBe("other");
    expect(classifyTool("bash")).toBe("other");
    expect(classifyTool("unfamiliar_tool")).toBe("other");
  });
});
