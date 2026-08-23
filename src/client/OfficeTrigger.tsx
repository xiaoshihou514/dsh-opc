import { useEffect, useState } from "react";
import type {
  ConversationNode,
  ObservableSnapshot,
} from "@deepseek-ai/dsh-client-runtime/client";
import { OfficePanel } from "./OfficePanel.tsx";
import { OfficeTestPage } from "./OfficeTestPage.tsx";

function isOfficeTestPath(): boolean {
  return (
    window.location.pathname === "/office-test" ||
    window.location.pathname === "/:/office-test" ||
    window.location.hash === "#/office-test" ||
    new URLSearchParams(window.location.search).has("office-test")
  );
}

/** A game-like mode switch that takes over the client until dismissed. */
export function OfficeTrigger({
  onSendPrompt,
  onConversation,
}: {
  onSendPrompt(sessionId: string, text: string): Promise<void>;
  onConversation(
    sessionId: string,
  ): ObservableSnapshot<{ nodes: readonly ConversationNode[] }> | undefined;
}): JSX.Element {
  if (isOfficeTestPath()) return <OfficeTestPage />;
  return <OfficeLauncher onSendPrompt={onSendPrompt} onConversation={onConversation} />;
}

function OfficeLauncher({
  onSendPrompt,
  onConversation,
}: {
  onSendPrompt(sessionId: string, text: string): Promise<void>;
  onConversation(
    sessionId: string,
  ): ObservableSnapshot<{ nodes: readonly ConversationNode[] }> | undefined;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return (
    <>
      <button
        type="button"
        aria-label="打开 DSH 作战室"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          top: 76,
          right: 20,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 42,
          padding: "0 15px 0 12px",
          border: "1px solid #ffd47788",
          borderRadius: 8,
          background: "linear-gradient(135deg,#352842,#1d2e45)",
          boxShadow: "0 4px 16px #0006",
          color: "#ffe4a7",
          cursor: "pointer",
          font: "700 13px ui-rounded,system-ui",
          letterSpacing: ".06em",
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 18 }}>
          ⌂
        </span>
        <span>作战室</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="DSH 作战室"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            overflow: "auto",
          }}
        >
          <OfficePanel
            onExit={() => setOpen(false)}
            onSendPrompt={onSendPrompt}
            onConversation={onConversation}
          />
        </div>
      ) : null}
    </>
  );
}
