import { readdir, readFile, stat } from "node:fs/promises";
import { join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { CharacterManifest } from "./protocol.ts";
import type { SessionState } from "./protocol.ts";

const ANIMATION_FILE =
  /^(idle|thinking|reading|writing|await|error)-(\d+)\.webm$/;
/** Desktop-pet loops live in pet/<state>-<variant>.webm, separate from session characters. */
const PET_ANIMATION_FILE = /^(idle|submit)-(\d+)\.webm$/;

/** Assets beside the plugin checkout are the only source; this plugin is self-hosted. */
export function bundledAssetDir(): string {
  return fileURLToPath(new URL("../assets/", import.meta.url));
}

export interface AssetStatus {
  directory: string;
  installed: boolean;
  localDev: boolean;
}

export async function assetStatus(): Promise<AssetStatus> {
  return {
    directory: bundledAssetDir(),
    localDev: true,
    installed: true,
  };
}

/** All assets live in the plugin's own assets/ directory (local-only plugin). */
export async function activeAssetDir(): Promise<string> {
  return bundledAssetDir();
}

/** Max modification time (ms) across every served asset file. The manifest
 *  carries it so clients can bust immutable caches when any clip or
 *  background changes, without disabling caching in the normal case. */
async function computeRevision(root: string): Promise<number> {
  let latest = 0;
  const touch = async (path: string): Promise<void> => {
    try {
      latest = Math.max(latest, (await stat(path)).mtimeMs);
    } catch {}
  };
  const scanWebm = async (dir: string): Promise<void> => {
    try {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await scanWebm(path);
        else if (entry.name.endsWith(".webm")) await touch(path);
      }
    } catch {}
  };
  await touch(join(root, "manifest.json"));
  await scanWebm(join(root, "characters"));
  await scanWebm(join(root, "pet"));
  for (const name of [
    "office-morning.png",
    "office-noon.png",
    "office-afternoon.png",
    "office-evening.png",
    "office-night.png",
  ])
    await touch(join(root, name));
  return Math.floor(latest);
}

export async function readManifest(
  root = bundledAssetDir(),
): Promise<CharacterManifest | undefined> {
  try {
    const base = JSON.parse(
      await readFile(join(root, "manifest.json"), "utf8"),
    ) as CharacterManifest;
    const characters: NonNullable<CharacterManifest["characters"]> = {};
    const directories = await readdir(join(root, "characters"), {
      withFileTypes: true,
    });
    for (const directory of directories) {
      if (!directory.isDirectory()) continue;
      const variants = new Map<
        SessionState,
        Array<{ file: string; index: number }>
      >();
      for (const file of await readdir(
        join(root, "characters", directory.name),
      )) {
        const match = ANIMATION_FILE.exec(file);
        if (match === null) continue;
        const state = match[1] as SessionState;
        const entries = variants.get(state) ?? [];
        entries.push({ file, index: Number(match[2]) });
        variants.set(state, entries);
      }
      const states: Partial<Record<SessionState, readonly string[]>> = {};
      for (const [state, files] of variants) {
        states[state] = files
          .sort(
            (left, right) =>
              left.index - right.index || left.file.localeCompare(right.file),
          )
          .map(({ file }) => file);
      }
      if (Object.keys(states).length > 0)
        characters[directory.name] = { states };
    }
    // The pet loop lives in pet/<state>-<variant>.webm and is surfaced under the
    // manifest's own `pet` field, never inside `characters`.
    const pet: NonNullable<CharacterManifest["pet"]> = {};
    try {
      const petVariants = new Map<
        "idle" | "submit",
        Array<{ file: string; index: number }>
      >();
      for (const file of await readdir(join(root, "pet"))) {
        const match = PET_ANIMATION_FILE.exec(file);
        if (match === null) continue;
        const state = match[1] as "idle" | "submit";
        const entries = petVariants.get(state) ?? [];
        entries.push({ file, index: Number(match[2]) });
        petVariants.set(state, entries);
      }
      for (const [state, files] of petVariants) {
        pet[state] = files
          .sort(
            (left, right) =>
              left.index - right.index || left.file.localeCompare(right.file),
          )
          .map(({ file }) => file);
      }
    } catch {}
    return { ...base, characters, pet, revision: await computeRevision(root) };
  } catch {
    return undefined;
  }
}

export function safeAssetPath(
  root: string,
  requestPath: string,
): string | undefined {
  const relative = normalize(requestPath).replace(/^[/\\]+/, "");
  const output = resolve(root, relative);
  return output.startsWith(`${resolve(root)}/`) ? output : undefined;
}

export async function serveAsset(
  root: string,
  req: IncomingMessage,
  res: ServerResponse,
  cacheControl = "public, max-age=31536000, immutable",
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405).end();
    return;
  }
  // URL.pathname is percent-encoded. Decode it before resolving the local
  // filename so character IDs such as “打工人” serve their WebM correctly.
  let pathname: string;
  try {
    pathname = decodeURIComponent(
      new URL(req.url ?? "/", "http://localhost").pathname,
    );
  } catch {
    res.writeHead(400).end();
    return;
  }
  const file = safeAssetPath(root, pathname.replace("/dsh-opc/v1/assets/", ""));
  if (file === undefined) {
    res.writeHead(403).end();
    return;
  }
  try {
    const manifest = file.endsWith("manifest.json")
      ? await readManifest(root)
      : undefined;
    const content =
      manifest === undefined
        ? await readFile(file)
        : Buffer.from(JSON.stringify(manifest));
    const type = file.endsWith(".webm")
      ? "video/webm"
      : file.endsWith(".json")
        ? "application/json; charset=utf-8"
        : "image/png";
    // The manifest is tiny and carries the asset revision, so it is always
    // revalidated; clips/backgrounds keep the caller's (immutable) cache and
    // are busted by the revision query on their URLs.
    const noStore = file.endsWith("manifest.json");
    res.writeHead(200, {
      "content-type": type,
      "cache-control": noStore ? "no-store" : cacheControl,
    });
    if (req.method === "GET") res.end(content);
    else res.end();
  } catch {
    res.writeHead(404).end();
  }
}
