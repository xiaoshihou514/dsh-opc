import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { readManifest } from "../src/assets.ts";
import { characterForModel, type CharacterManifest } from "../src/protocol.ts";

describe("animation manifest discovery", () => {
  it("matches model names without case sensitivity", () => {
    const manifest = {
      apiVersion: 1,
      fallbackCharacter: "打工人",
      modelCharacters: { "GLM-5.2": "小狐狸" },
    } satisfies CharacterManifest;

    expect(characterForModel("glm-5.2", manifest)).toBe("小狐狸");
  });

  it("collects and numerically sorts every state variant on disk", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-opc-assets-"));
    await mkdir(join(root, "characters", "小狐狸"), { recursive: true });
    await writeFile(
      join(root, "manifest.json"),
      JSON.stringify({
        apiVersion: 1,
        fallbackCharacter: "小狐狸",
        modelCharacters: { model: "小狐狸" },
      }),
    );
    for (const file of [
      "thinking-10.webm",
      "thinking-2.webm",
      "idle-0.webm",
      "notes.txt",
    ])
      await writeFile(join(root, "characters", "小狐狸", file), "fixture");

    const manifest = await readManifest(root);

    expect(manifest?.characters?.["小狐狸"]?.states).toEqual({
      idle: ["idle-0.webm"],
      thinking: ["thinking-2.webm", "thinking-10.webm"],
    });
  });
});
