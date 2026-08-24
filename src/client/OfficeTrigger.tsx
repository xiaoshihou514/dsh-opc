import type {
  ConversationNode,
  ObservableSnapshot,
} from "@deepseek-ai/dsh-client-runtime/client";
import { OfficePanel } from "./OfficePanel.tsx";
import { OfficeTestPage } from "./OfficeTestPage.tsx";
import type { OfficeModelState, OfficeSessionList } from "./index.ts";

function isOfficeTestPath(): boolean {
  return (
    window.location.pathname === "/office-test" ||
    window.location.pathname === "/:/office-test" ||
    window.location.hash === "#/office-test" ||
    new URLSearchParams(window.location.search).has("office-test")
  );
}

function isOfficePath(): boolean {
  return (
    window.location.pathname === "/office" ||
    window.location.pathname === "/:/office" ||
    new URLSearchParams(window.location.search).has("office")
  );
}

/** The office is a first-class `/office` page; outside it we show the entry button. */
export function OfficeTrigger({
  onSendPrompt,
  onConversation,
  sessionList,
  archivedSessionIds,
  openSession,
  modelSelection,
}: {
  onSendPrompt(sessionId: string, text: string): Promise<void>;
  onConversation(
    sessionId: string,
  ): ObservableSnapshot<{ nodes: readonly ConversationNode[] }> | undefined;
  sessionList: ObservableSnapshot<OfficeSessionList>;
  archivedSessionIds?: ObservableSnapshot<readonly string[]> | undefined;
  openSession(sessionId: string): void;
  modelSelection(sessionId: string): ObservableSnapshot<OfficeModelState>;
}): JSX.Element {
  if (isOfficeTestPath()) return <OfficeTestPage />;
  if (isOfficePath()) {
    const leave = (): void => {
      window.location.href = "/";
    };
    return (
      <OfficePanel
        onSendPrompt={onSendPrompt}
        onConversation={onConversation}
        sessionList={sessionList}
        archivedSessionIds={archivedSessionIds}
        onOpenNative={(id) => {
          openSession(id);
          leave();
        }}
        onExit={leave}
        modelSelection={modelSelection}
      />
    );
  }
  return <OfficeLauncher />;
}

function OfficeLauncher(): JSX.Element {
  return (
    <button
      type="button"
      aria-label="打开 DSH 办公室"
      onClick={() => {
        window.location.href = "/office";
      }}
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
      <span>办公室</span>
    </button>
  );
}
