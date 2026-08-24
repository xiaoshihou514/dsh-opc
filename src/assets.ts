import { createWriteStream } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { once } from "node:events";
import { homedir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { CharacterManifest } from "./protocol.ts";
import type { SessionState } from "./protocol.ts";

const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;
const RELEASE_REPOSITORY =
  process.env.DSH_OPC_ASSET_REPOSITORY ?? "xiaoshihou514/dsh-opc";
const RELEASE_ASSET = "dsh-opc-assets.tar.gz";
const ANIMATION_FILE =
  /^(idle|thinking|reading|writing|await|error|submit)-(\d+)\.webm$/;

export function assetCacheDir(): string {
  return join(process.env.DSH_HOME?.trim() || join(homedir(), ".dsh"), "opc");
}

/** Assets beside a linked checkout are local-development assets, never downloaded. */
export function bundledAssetDir(): string {
  return fileURLToPath(new URL("../assets/", import.meta.url));
}

async function hasWebm(root: string): Promise<boolean> {
  try {
    const characters = await readdir(join(root, "characters"), {
      withFileTypes: true,
    });
    for (const character of characters) {
      if (!character.isDirectory()) continue;
      if (
        (await readdir(join(root, "characters", character.name))).some((file) =>
          file.endsWith(".webm"),
        )
      )
        return true;
    }
  } catch {}
  return false;
}

export interface AssetStatus {
  directory: string;
  installed: boolean;
  localDev: boolean;
}

export async function assetStatus(): Promise<AssetStatus> {
  const localDev = await hasWebm(bundledAssetDir());
  return {
    directory: assetCacheDir(),
    localDev,
    installed: localDev || (await hasWebm(assetCacheDir())),
  };
}

/** Chooses checkout assets for local development, otherwise the user-managed cache. */
export async function activeAssetDir(): Promise<string> {
  return (await assetStatus()).localDev ? bundledAssetDir() : assetCacheDir();
}

export async function readManifest(
  root = assetCacheDir(),
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
        SessionState | "submit",
        Array<{ file: string; index: number }>
      >();
      for (const file of await readdir(
        join(root, "characters", directory.name),
      )) {
        const match = ANIMATION_FILE.exec(file);
        if (match === null) continue;
        const state = match[1] as SessionState | "submit";
        const entries = variants.get(state) ?? [];
        entries.push({ file, index: Number(match[2]) });
        variants.set(state, entries);
      }
      const states: Partial<
        Record<SessionState | "submit", readonly string[]>
      > = {};
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
    return { ...base, characters };
  } catch {
    return undefined;
  }
}

/** Fetches the release asset opportunistically; a bundled/local cache remains usable offline. */
export async function updateAssets(
  logger: { warn(message: string): void },
  onProgress?: (received: number, total: number) => void,
): Promise<void> {
  const root = assetCacheDir();
  const endpoint = `https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/latest`;
  try {
    const release = await fetch(endpoint, {
      headers: { accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!release.ok)
      throw new Error(`release lookup returned HTTP ${release.status}`);
    const body = (await release.json()) as {
      assets?: Array<{
        name: string;
        browser_download_url: string;
        size?: number;
      }>;
    };
    const asset = body.assets?.find(
      (candidate) => candidate.name === RELEASE_ASSET,
    );
    if (asset === undefined) return;
    if ((asset.size ?? 0) > MAX_ARCHIVE_BYTES)
      throw new Error("release asset exceeds size limit");
    const marker = join(root, ".release-url");
    const current = await readFile(marker, "utf8").catch(() => "");
    if (current.trim() === asset.browser_download_url) return;
    const download = await fetch(asset.browser_download_url, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!download.ok || download.body === null)
      throw new Error(`asset download returned HTTP ${download.status}`);
    const length = Number(download.headers.get("content-length") ?? 0);
    if (length > MAX_ARCHIVE_BYTES)
      throw new Error("download exceeds size limit");
    const staging = `${root}.staging-${process.pid}`;
    await mkdir(staging, { recursive: true, mode: 0o700 });
    const archive = join(staging, RELEASE_ASSET);
    const output = createWriteStream(archive, { mode: 0o600 });
    let received = 0;
    onProgress?.(received, length);
    for await (const chunk of download.body as unknown as AsyncIterable<Uint8Array>) {
      received += chunk.byteLength;
      if (received > MAX_ARCHIVE_BYTES)
        throw new Error("download exceeds size limit");
      if (!output.write(chunk)) await once(output, "drain");
      onProgress?.(received, length);
    }
    output.end();
    await once(output, "finish");
    const downloaded = await stat(archive);
    if (downloaded.size > MAX_ARCHIVE_BYTES)
      throw new Error("download exceeds size limit");
    // Deliberately use tar's safe extraction flags and a controlled staging root.
    await mkdir(dirname(root), { recursive: true, mode: 0o700 });
    await mkdir(root, { recursive: true, mode: 0o700 });
    const { execFile } = await import("node:child_process");
    await new Promise<void>((resolveExtract, rejectExtract) =>
      execFile(
        "tar",
        ["-xzf", archive, "--no-same-owner", "-C", root],
        (error) => (error ? rejectExtract(error) : resolveExtract()),
      ),
    );
    const manifest = await readManifest(root);
    if (manifest?.apiVersion !== 1)
      throw new Error("release asset has no supported manifest");
    await writeFile(marker, `${asset.browser_download_url}\n`, { mode: 0o600 });
    await unlink(archive).catch(() => {});
  } catch (error) {
    logger.warn(
      `dsh-opc: asset update skipped: ${error instanceof Error ? error.message : String(error)}`,
    );
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
    res.writeHead(200, {
      "content-type": type,
      "cache-control": cacheControl,
    });
    if (req.method === "GET") res.end(content);
    else res.end();
  } catch {
    res.writeHead(404).end();
  }
}
