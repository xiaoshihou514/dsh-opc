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

/**
 * A small always-on hover pet pinned to the bottom-right of the native DSH
 * conversation interface. It follows the host's current session and plays that
 * session's character loop, so the character animation lives on the native
 * chat instead of a bespoke panel.
 */
export function PetFloat({
  sessionList,
  modelSelection,
  onOpen,
}: {
  sessionList: ObservableSnapshot<OfficeSessionList>;
  modelSelection(sessionId: string): ObservableSnapshot<OfficeModelState>;
  onOpen(sessionId: string): void;
}): JSX.Element | null {
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
  const model = current.model || selectedModel || "default";
  const character = sessionCharacter({ ...current, model }, manifest);
  const src = animationUrl(character, current.state, manifest);
  const label = LABELS[current.state] ?? current.state;

  return (
    <button
      type="button"
      onClick={() => onOpen(current.id)}
      aria-label={`角色 ${character} · ${label}`}
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
      <LoopVideo
        className="opc-pet-video"
        src={src}
        style={{ width: 192, height: 192, objectFit: "contain" }}
      />
    </button>
  );
}

/** Style for the pet loop video (kept here so consumers only need the component). */
export const PET_STYLE =
  `@media(max-width:760px){.opc-pet-video{width:128px;height:128px}}` as const;
