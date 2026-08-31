import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { ObservableSnapshot } from "@deepseek-ai/dsh-client-runtime/client";
import { SessionStore } from "./session-store.ts";
import { LoopVideo, animationUrl, sessionCharacter } from "./OfficePanel.tsx";
import type { CharacterManifest } from "../protocol.ts";
import type { OfficeModelState, OfficeSessionList } from "./index.ts";

const LABELS = {
  idle: "待命",
  thinking: "思考",
  reading: "阅读",
  writing: "编写",
  await: "等待授权",
  error: "错误",
} as const;

// Poké-ball shape for the collapsed pet. Drawn in CSS so the native
// conversation page needs no extra assets. Sized at a quarter of the 192px
// animation (48px) since folding is meant to save space. Colored with the dsh
// DeepSeek palette (deepseek-450 blue cap / deepseek-900 navy band /
// deepseek-50 ice-white base) instead of the Pokémon red-white-black, so the
// ball stays on-brand without a trademark lookalike.
const PET_BALL_CSS = `.opc-pet-ball{position:relative;display:block;width:48px;height:48px;border:3px solid #283142;border-radius:50%;background:linear-gradient(#5686FE 0 46%,#283142 46% 54%,#EDF3FE 54%);box-shadow:inset -6px -8px #0003,0 4px 0 #070a12;cursor:pointer;transition:transform .12s ease}.opc-pet-ball:hover{transform:scale(1.12)}.opc-pet-ball:before{content:'';position:absolute;left:50%;top:50%;width:34%;aspect-ratio:1;transform:translate(-50%,-50%);border:3px solid #283142;border-radius:50%;background:#ffffff;box-shadow:inset 0 0 0 5px #679EFE}.opc-pet-ball:after{content:'';position:absolute;inset:12%;border-radius:50%;border:2px solid #ffffff55;pointer-events:none}.opc-pet-ball-running{animation:opc-pet-ball-spin 1.1s linear infinite}@keyframes opc-pet-ball-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.opc-pet-ball-running{animation:none}}`;

let petStyleInjected = false;
function ensurePetStyle(): void {
  if (petStyleInjected) return;
  petStyleInjected = true;
  const style = document.createElement("style");
  style.textContent = PET_BALL_CSS;
  document.head.append(style);
}

/**
 * A small always-on hover pet pinned to the bottom-right of the native DSH
 * conversation interface. It follows the host's current session and plays that
 * session's character loop, so the character animation lives on the native
 * chat instead of a bespoke panel. Clicking the animation folds the pet into a
 * poké ball; clicking the ball unfolds it again.
 */
export function PetFloat({
  sessionList,
  modelSelection,
}: {
  sessionList: ObservableSnapshot<OfficeSessionList>;
  modelSelection(sessionId: string): ObservableSnapshot<OfficeModelState>;
}): JSX.Element | null {
  ensurePetStyle();
  // The office overview (/office or ?office=1) already shows the characters;
  // the floating pet is only for the native conversation, so skip its network
  // work entirely there (no SSE, no manifest fetch, no re-renders).
  const isOffice =
    window.location.pathname === "/office" ||
    window.location.pathname === "/:/office" ||
    new URLSearchParams(window.location.search).has("office");
  const [store] = useState(() => new SessionStore());
  const [snapshot, setSnapshot] = useState(store.snapshot);
  const [manifest, setManifest] = useState<CharacterManifest>();
  const [catalog, setCatalog] = useState(() => sessionList.getSnapshot());
  const [selectedModel, setSelectedModel] = useState<string>();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (isOffice) return;
    const stop = store.subscribe(() => setSnapshot(store.snapshot));
    store.start();
    return () => {
      stop();
      store.stop();
    };
  }, [store, isOffice]);
  useEffect(() => {
    const update = (): void => setCatalog(sessionList.getSnapshot());
    update();
    return sessionList.subscribe(update);
  }, [sessionList]);
  useEffect(() => {
    if (isOffice || catalog.current === undefined) return;
    let directory: ObservableSnapshot<OfficeModelState>;
    try {
      directory = modelSelection(catalog.current);
    } catch {
      setSelectedModel(undefined);
      return;
    }
    const update = (): void =>
      setSelectedModel(directory.getSnapshot().current?.model);
    update();
    return directory.subscribe(update);
  }, [catalog.current, isOffice, modelSelection]);
  useEffect(() => {
    if (isOffice) return;
    void fetch("/dsh-opc/v1/assets/manifest.json", { cache: "no-store" })
      .then((response) => response.json())
      .then(setManifest)
      .catch(() => {});
  }, [isOffice]);

  const currentId = catalog.current;
  const current = snapshot?.sessions.find(
    (session) => session.id === currentId,
  );
  if (isOffice || current === undefined) return null;
  // Resolve the character with the same front-end manifest logic the office
  // uses, so the pet and the worker card always agree.
  const model = selectedModel ?? current.model ?? "default";
  const character = sessionCharacter({ ...current, model }, manifest);
  const src = animationUrl(
    character,
    current.state,
    manifest,
    manifest?.revision?.toString(),
  );
  const label = LABELS[current.state] ?? current.state;
  const running = current.runningSince !== undefined;

  return (
    <button
      type="button"
      onClick={() => setCollapsed((value) => !value)}
      aria-label={
        collapsed
          ? `展开角色 ${character} · ${label}`
          : `收起角色 ${character} · ${label}`
      }
      title={collapsed ? "展开角色动画" : "收起角色动画"}
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 40,
        padding: 0,
        border: 0,
        background: "transparent",
        boxShadow: "none",
        lineHeight: 0,
        cursor: "pointer",
      }}
    >
      {collapsed ? (
        <span
          className={`opc-pet-ball${running ? " opc-pet-ball-running" : ""}`}
          aria-hidden="true"
        />
      ) : (
        <LoopVideo
          className="opc-pet-video"
          src={src}
          style={{ width: 192, height: 192, objectFit: "contain" }}
        />
      )}
    </button>
  );
}

/** Style for the pet loop video (kept here so consumers only need the component). */
export const PET_STYLE =
  `@media(max-width:760px){.opc-pet-video{width:128px;height:128px}}` as const;
