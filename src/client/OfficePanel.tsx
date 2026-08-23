import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { MarkdownText } from "@deepseek-ai/dsh-client-ui-primitives";
import type {
  CharacterManifest,
  SessionState,
  SessionView,
} from "../protocol.ts";
import type {
  ConversationNode,
  ObservableSnapshot,
} from "@deepseek-ai/dsh-client-runtime/client";
import { SessionStore } from "./session-store.ts";
import {
  OFFICE_SHADERS,
  officeTimeAt,
  type OfficeTime,
} from "./office-shaders.ts";

// A focused, full-screen "command room" rather than a dashboard: the scene is
// the primary surface, and the selected character is the person being briefed.
const OFFICE_CSS = `.opc-office{min-height:100vh;color:#f8e9c5;background:#111620;background-image:linear-gradient(#ffffff05 1px,transparent 1px),linear-gradient(90deg,#ffffff05 1px,transparent 1px),radial-gradient(circle at 50% -20%,#465171 0,#161b29 50%,#0a0d15 100%);background-size:24px 24px,24px 24px,auto;font-family:"Microsoft YaHei",ui-rounded,system-ui,sans-serif;overflow:auto}.opc-office *{box-sizing:border-box}.opc-topbar{height:58px;padding:0 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #c48d43;background:#111827e8;box-shadow:0 3px #0008}.opc-mark{display:flex;align-items:center;gap:10px;color:#ffe1a0;font-weight:900;letter-spacing:.12em}.opc-mark b{color:#8dd8d1}.opc-exit{border:2px solid #946c3a;background:#251d24;color:#f6dba0;padding:7px 14px;box-shadow:inset 0 0 0 2px #ffffff0d,2px 2px #080a11;cursor:pointer;font:700 13px inherit}.opc-exit:hover{background:#3c2931}.opc-stage{max-width:1500px;min-height:calc(100vh - 58px);margin:auto;padding:18px;display:grid;grid-template-rows:auto minmax(500px,1fr) auto;gap:12px}.opc-sceneTitle{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-left:5px solid #e9b75b;background:#101522cc}.opc-sceneTitle h1{margin:0;color:#fff0c9;font-size:24px;letter-spacing:.1em}.opc-sceneTitle p{margin:0;color:#a8c6d4;font-size:12px}.opc-assets{display:flex;flex-wrap:wrap;gap:7px;padding:9px 12px;border:1px solid #d6a84d;background:#523c21;color:#fff0bd;font-size:12px}.opc-assets strong{width:100%}.opc-assets code{color:#fff}.opc-assets progress{width:100%;height:7px;accent-color:#ffd36b}.opc-floor{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(3,minmax(145px,1fr));gap:10px;min-height:0;padding:14px;border:2px solid #596078;background:linear-gradient(135deg,#30394cbb,#202737bb),repeating-linear-gradient(45deg,#fff1 0 1px,transparent 1px 12px);box-shadow:inset 0 0 0 3px #111621,inset 0 0 55px #0008}.opc-worker,.opc-emptySeat{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-height:0;padding:7px;border:2px solid #435069;background:linear-gradient(180deg,#263449,#19202f 65%,#121722);color:inherit;box-shadow:inset 0 0 0 1px #ffffff0c,3px 3px #090c13;overflow:hidden;font:inherit;text-align:center}.opc-worker{cursor:pointer;transition:transform .12s ease,border-color .12s ease,filter .12s ease}.opc-worker:hover,.opc-worker:focus-visible,.opc-worker[data-selected=true]{z-index:1;transform:translate(-2px,-2px);border-color:#ffce6c;filter:brightness(1.17);outline:none}.opc-worker[data-selected=true]:after{content:"指令中";position:absolute;top:6px;left:6px;padding:2px 5px;background:#f5be58;color:#251810;font-size:10px;font-weight:900}.opc-emptySeat{justify-content:center;border-style:dashed;color:#708096;background:#151b28aa}.opc-emptySeat span{font-size:28px}.opc-monitor{position:relative;z-index:1;width:100%;padding:4px 7px;overflow:hidden;border-bottom:1px solid #6d8099;color:#d9f5ff;background:#172535;font-size:11px}.opc-monitor span,.opc-monitor small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.opc-monitor small,.opc-worker>small{color:#aab7ca}.opc-video,.opc-fallback{display:block;width:100%;height:clamp(86px,14vh,145px);object-fit:contain}.opc-fallback{padding-top:22px;color:#ffdc81;font-size:52px}.opc-worker strong{position:relative;z-index:1;color:#ffe9bc;font-size:13px}.opc-state{position:relative;z-index:1;margin-top:3px;color:#9ad9d2;font-size:11px}.opc-attention{position:absolute;z-index:2;top:5px;right:5px;display:grid;place-items:center;width:21px;height:21px;border:2px solid #351922;border-radius:50%;color:#fff;background:#dd5d62;font-weight:900}.opc-waiting_permission{border-color:#e6b552}.opc-error{border-color:#d86b6a}.opc-comms{display:grid;grid-template-columns:205px minmax(0,1fr);min-height:210px;border:2px solid #6c5f62;background:#171520;box-shadow:inset 0 0 0 2px #ffffff0b,4px 4px #080b11}.opc-commsHeader{padding:16px;border-right:2px solid #6c5f62;background:linear-gradient(155deg,#493244,#261f31)}.opc-commsHeader p,.opc-commsHeader h2{margin:0}.opc-commsHeader p{color:#f7c973;font-size:11px;letter-spacing:.16em}.opc-commsHeader h2{margin-top:7px;color:#fff2d2;font-size:19px}.opc-dialogue{display:flex;gap:9px;overflow:auto;padding:14px 14px 0;min-width:0;max-height:140px}.opc-speech{flex:none;max-width:350px;padding:11px 14px;border:1px solid #d5a550;background:#33263a;color:#f5e7d0;box-shadow:3px 3px #0b0b11;line-height:1.55;font-size:14px;white-space:pre-wrap;overflow:hidden;text-overflow:ellipsis}.opc-speech[data-error=true]{border-color:#df7472;background:#48242d}.opc-speech small{display:block;margin-bottom:4px;color:#ffcf71;font-size:10px;letter-spacing:.08em}.opc-order{grid-column:2;padding:0 14px 13px}.opc-order textarea{display:block;width:100%;height:46px;resize:none;padding:11px;border:1px solid #8b7b80;background:#0d1018;color:#fff;font:inherit;line-height:1.45}.opc-order textarea:focus{outline:2px solid #f3c464}.opc-orderRow{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:7px;color:#a7a6b5;font-size:11px}.opc-send{border:2px solid #ffda88;background:#b95d3e;color:#fff7e7;padding:6px 15px;box-shadow:2px 2px #3b1e22;cursor:pointer;font:800 12px inherit}.opc-send:hover{background:#dc7650}.opc-send:disabled{opacity:.55;cursor:wait}.opc-result{margin:0;color:#ffb6ad;font-size:12px}@media(max-width:760px){.opc-topbar{padding:0 12px}.opc-stage{padding:8px;grid-template-rows:auto 500px auto}.opc-floor{gap:5px;padding:6px}.opc-comms{grid-template-columns:1fr}.opc-commsHeader{border-right:0;border-bottom:1px solid #6c5f62;padding:10px}.opc-order{grid-column:1}.opc-video,.opc-fallback{height:76px}.opc-sceneTitle h1{font-size:18px}}`;
// The generated environment is the office itself; the controls merely sit on
// top of it. This deliberately overrides the earlier generic panel geometry.
const GAME_CSS = `.opc-stage{position:relative;max-width:1660px;grid-template-rows:auto auto minmax(540px,1fr);padding:14px}.opc-floor{grid-row:3;aspect-ratio:16/9;min-height:auto;max-height:calc(100vh - 155px);padding:3.2% 7%;gap:0;border:4px solid #6a4f35;background:url('/dsh-opc/v1/assets/office-background.png') center/cover no-repeat;box-shadow:0 0 0 2px #17111a,0 14px 40px #000a}.opc-worker,.opc-emptySeat{border:0;background:transparent;box-shadow:none;border-radius:0;overflow:visible}.opc-worker{justify-content:flex-end;filter:none}.opc-worker:hover,.opc-worker:focus-visible,.opc-worker[data-selected=true]{transform:none;border:0;filter:none}.opc-worker[data-selected=true]:after{display:none}.opc-emptySeat{opacity:0}.opc-video,.opc-fallback{position:absolute;z-index:2;bottom:7%;left:18%;width:64%;height:78%;padding:0;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(2px 3px 0 #071018aa)}.opc-monitor{position:absolute;z-index:4;bottom:0;left:13%;width:74%;padding:3px 5px;border:1px solid #8aa9b7;background:#111b25df;box-shadow:2px 2px #0008}.opc-worker strong,.opc-worker>.opc-state,.opc-worker>small{display:none}.opc-attention{z-index:5;top:10%;right:16%}.opc-comms{position:fixed;z-index:20;inset:7vh 6vw 6vh;display:grid;grid-template-rows:78px minmax(0,1fr) auto;grid-template-columns:1fr;min-height:0;border:4px solid #e2b65d;background:#151727f8;box-shadow:0 0 0 4px #241923,0 20px 80px #000c}.opc-commsHeader{display:flex;align-items:center;justify-content:space-between;padding:15px 24px;border-right:0;border-bottom:3px solid #70544d;background:linear-gradient(90deg,#54384b,#27334c)}.opc-commsHeader h2{font-size:24px}.opc-chatClose{border:2px solid #e1ba6a;background:#2c2533;color:#ffe9bc;padding:7px 14px;box-shadow:2px 2px #080910;cursor:pointer;font:700 12px inherit}.opc-dialogue{display:flex;flex-direction:column;align-items:flex-start;gap:12px;overflow:auto;max-height:none;padding:24px 8%;background:linear-gradient(#101521cc,#101521cc),repeating-linear-gradient(0deg,transparent 0 30px,#ffffff06 30px 31px)}.opc-speech{flex:none;max-width:min(780px,85%);overflow:visible;padding:13px 17px;border:2px solid #d7ad5b;background:#32263a;box-shadow:4px 4px #080910;font-size:14px;white-space:pre-wrap}.opc-speech[data-error=true]{border-color:#ed8376;background:#562b35}.opc-order{grid-column:1;padding:16px 8%;border-top:3px solid #70544d;background:#1c1c2a}.opc-order textarea{height:72px;border:2px solid #9c826a;background:#090b12;font-size:14px}.opc-orderRow{font-size:12px}.opc-send{padding:9px 20px;font-size:13px}@media(max-width:760px){.opc-floor{padding:3.2% 7%;max-height:none}.opc-comms{inset:5vh 3vw}.opc-dialogue{padding:18px}.opc-order{padding:12px}.opc-commsHeader{padding:10px 14px}.opc-commsHeader h2{font-size:18px}.opc-video,.opc-fallback{height:75%}}`;
// The generated backgrounds are not geometrically identical. Anchor each
// worker to its hand-tuned workstation position instead of a CSS layout grid.
const ANCHOR_CSS = `.opc-floor{display:block;padding:0}.opc-worker,.opc-emptySeat{position:absolute;left:var(--opc-seat-x);top:var(--opc-seat-y);width:28%;aspect-ratio:1;min-height:0;padding:0;transform:translate(-50%,-90%) scale(var(--opc-seat-scale));transform-origin:center bottom}.opc-worker{z-index:3}.opc-worker:hover,.opc-worker:focus-visible,.opc-worker[data-selected=true]{z-index:8;transform:translate(-50%,-90%) scale(var(--opc-seat-scale))}.opc-emptySeat{z-index:2}.opc-video,.opc-fallback{inset:0;width:100%;height:100%}.opc-monitor{bottom:5%;left:8%;width:84%}@media(max-width:760px){.opc-floor{padding:0}.opc-video,.opc-fallback{height:100%}}`;
const SHADER_CSS = `.opc-floor{isolation:isolate;background-image:var(--opc-office-background)!important;background-position:center;background-size:cover;background-repeat:no-repeat}.opc-floor:after{content:'';position:absolute;z-index:10;inset:0;pointer-events:none;background:var(--opc-atmosphere);opacity:var(--opc-opacity);mix-blend-mode:var(--opc-blend);animation:opc-light-breathe 12s ease-in-out infinite alternate}.opc-video{filter:var(--opc-character-filter) drop-shadow(2px 3px 0 #071018aa)}@keyframes opc-light-breathe{from{opacity:calc(var(--opc-opacity) * .88)}to{opacity:var(--opc-opacity)}}@media(prefers-reduced-motion:reduce){.opc-floor:after{animation:none}}`;
const CHAT_CSS = `.opc-commsMain{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,34%);min-height:0;overflow:hidden}.opc-dialogue{display:flex;flex-direction:column;gap:14px;max-height:none;padding:24px 6%;background:#101521;scrollbar-color:#765f51 #0d111b}.opc-message{width:min(880px,94%);color:#e9e5df;line-height:1.7;font-size:14px}.opc-message[data-role="user"]{align-self:flex-end;padding:11px 14px;border-left:3px solid #748ca2;background:#1c2531}.opc-message[data-role="assistant"]{align-self:flex-start}.opc-message[data-error=true]{padding:11px 14px;border:1px solid #e06e6b;background:#51252d;color:#ffd5cf}.opc-messageLabel{display:block;margin-bottom:5px;color:#d9ad58;font:700 10px/1.4 ui-monospace,SFMono-Regular,monospace;letter-spacing:.08em}.opc-disclosure{width:min(880px,94%);border-top:1px solid #3b4654;color:#cbd0d8}.opc-disclosure summary{display:flex;align-items:center;gap:8px;padding:9px 2px;cursor:pointer;color:#aeb7c3;font-size:12px;list-style:none}.opc-disclosure summary::-webkit-details-marker{display:none}.opc-disclosure summary:before{content:'›';color:#d4a94f;font-size:18px;line-height:1;transition:transform .12s}.opc-disclosure[open] summary:before{transform:rotate(90deg)}.opc-disclosureBody{margin:0 0 10px 18px;padding:10px 12px;border-left:2px solid #4a5665;background:#0c111a;color:#bec6d0;line-height:1.55;font:12px/1.55 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.opc-disclosure[data-error=true]{border-color:#7d343b}.opc-disclosure[data-error=true] summary{color:#ff8f88}.opc-chatActor{position:relative;isolation:isolate;overflow:hidden;border-left:2px solid #70544d;background:radial-gradient(circle at 50% 26%,#5c4a6b66,transparent 42%),linear-gradient(180deg,#20293a,#111622)}.opc-chatActor:after{content:'';position:absolute;z-index:3;inset:0;pointer-events:none;background:var(--opc-atmosphere);opacity:var(--opc-opacity);mix-blend-mode:var(--opc-blend)}.opc-chatActorVideo{position:absolute;z-index:2;left:50%;bottom:-3%;width:min(46vw,520px);height:92%;object-fit:contain;transform:translateX(-50%);image-rendering:pixelated;filter:var(--opc-character-filter) drop-shadow(5px 8px 0 #05081299)}.opc-chatActorHud{position:absolute;z-index:5;right:14px;bottom:14px;left:14px;padding:9px 11px;border:1px solid #8aa9b7;background:#101925e8;box-shadow:3px 3px #07090e}.opc-chatActorHud strong,.opc-chatActorHud small{display:block}.opc-chatActorHud strong{color:#ffe7b1}.opc-chatActorHud small{margin-top:2px;color:#91cbc6}.opc-order{grid-column:1/-1}.opc-commsHeader{grid-column:1/-1}@media(max-width:820px){.opc-commsMain{grid-template-columns:1fr}.opc-chatActor{display:none}.opc-dialogue{padding:18px}.opc-message,.opc-disclosure{width:100%}}`;

function ensureStyle(): void {
  if (document.querySelector("#dsh-opc-style") !== null) return;
  const style = document.createElement("style");
  style.id = "dsh-opc-style";
  style.textContent =
    OFFICE_CSS + GAME_CSS + SHADER_CSS + ANCHOR_CSS + CHAT_CSS;
  document.head.append(style);
}

const LABELS: Record<SessionState, string> = {
  idle: "待命中",
  thinking: "思考中",
  reading: "阅读中",
  writing: "编写中",
  waiting_job: "等待任务",
  waiting_permission: "等待授权",
  error: "发生错误",
};
export function animationUrl(
  character: string,
  state: SessionState,
  manifest: CharacterManifest | undefined,
  revision?: string,
): string {
  const exactFiles =
    manifest?.characters?.[character]?.states[state] ??
    manifest?.characters?.[manifest?.fallbackCharacter ?? ""]?.states[state] ??
    [];
  // An idle clip is optional while artists add the new state. Existing asset
  // packs use the semantically closest wait animation until one is supplied.
  const files =
    exactFiles.length > 0 || state !== "idle"
      ? exactFiles
      : (manifest?.characters?.[character]?.states.waiting_job ??
        manifest?.characters?.[manifest?.fallbackCharacter ?? ""]?.states
          .waiting_job ??
        []);
  const selected =
    files[Math.floor(Math.random() * files.length)] ??
    `${state === "idle" ? "waiting_job" : state}-0.webm`;
  const url = `/dsh-opc/v1/assets/characters/${encodeURIComponent(character)}/${encodeURIComponent(selected)}`;
  return revision === undefined
    ? url
    : `${url}?revision=${encodeURIComponent(revision)}`;
}

function Worker({
  session,
  manifest,
  selected,
  seatStyle,
  onSelect,
}: {
  session: SessionView;
  manifest: CharacterManifest | undefined;
  selected: boolean;
  seatStyle: CSSProperties;
  onSelect(): void;
}) {
  const [failed, setFailed] = useState(false);
  const [source, setSource] = useState(() =>
    animationUrl(session.character, session.state, manifest),
  );
  useEffect(() => {
    setFailed(false);
    setSource(animationUrl(session.character, session.state, manifest));
  }, [session.id, session.state, session.stateSince, manifest]);
  const attention =
    session.state === "waiting_permission" || session.state === "error";
  return (
    <button
      type="button"
      className={`opc-worker opc-${session.state}`}
      data-selected={selected || undefined}
      style={seatStyle}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`与 ${session.title} 通讯，${LABELS[session.state]}`}
    >
      <div className="opc-monitor">
        <span>{session.title}</span>
        <small>{session.model}</small>
      </div>
      {failed ? (
        <div className="opc-fallback" role="img" aria-label="角色动画不可用">
          ◉
        </div>
      ) : (
        <video
          className="opc-video"
          src={source}
          muted
          playsInline
          autoPlay
          loop
          onError={() => setFailed(true)}
        />
      )}
      <strong>{session.character}</strong>
      <span className="opc-state">{LABELS[session.state]}</span>
      {session.activeTool !== undefined ? (
        <small>{session.activeTool}</small>
      ) : null}
      {attention ? <span className="opc-attention">!</span> : null}
    </button>
  );
}

function EmptySeat({
  number,
  seatStyle,
}: {
  number: number;
  seatStyle: CSSProperties;
}): JSX.Element {
  return (
    <div
      className="opc-emptySeat"
      aria-label={`空闲工位 ${number}`}
      style={seatStyle}
    >
      <span aria-hidden="true">＋</span>
      <small>空闲工位</small>
    </div>
  );
}

interface AssetStatus {
  directory: string;
  installed: boolean;
  localDev: boolean;
  state: "local" | "idle" | "downloading" | "complete" | "error";
  received: number;
  total: number;
  error?: string;
}
function AssetPrompt({ onInstalled }: { onInstalled(): void }) {
  const [status, setStatus] = useState<AssetStatus>();
  useEffect(() => {
    const refresh = (): void => {
      void fetch("/dsh-opc/v1/assets/status", { cache: "no-store" })
        .then((response) => response.json())
        .then((next: AssetStatus) => {
          setStatus(next);
          if (next.installed) onInstalled();
        })
        .catch(() => {});
    };
    refresh();
    const timer = window.setInterval(refresh, 500);
    return () => window.clearInterval(timer);
  }, [onInstalled]);
  if (status === undefined || status.localDev || status.installed) return null;
  const percent =
    status.total === 0
      ? undefined
      : Math.min(100, Math.round((status.received / status.total) * 100));
  return (
    <aside className="opc-assets" role="status">
      <strong>
        {status.state === "error" ? "角色动画下载失败。" : "正在下载角色动画…"}
      </strong>
      <span>
        {status.state === "error" ? (
          status.error
        ) : (
          <>
            保存到 <code>{status.directory}</code>
            {percent === undefined ? "" : ` · ${percent}%`}
          </>
        )}
      </span>
      {status.state === "downloading" ? (
        <progress
          value={status.received}
          max={status.total || 1}
          aria-label="角色动画下载进度"
        />
      ) : null}
    </aside>
  );
}

const MARKDOWN_LABELS = { copyLabel: "复制", copiedLabel: "已复制" };

function ConversationEntry({
  node,
}: {
  node: ConversationNode;
}): JSX.Element | null {
  if (node.kind === "tool-result") {
    const output = node.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const text =
      output ||
      (node.isError
        ? `${node.error?.name ?? "工具错误"}: ${node.error?.code ?? "执行失败"}`
        : node.call?.argsRaw || "执行完成");
    return (
      <details
        className="opc-disclosure"
        data-error={node.isError || undefined}
        open={node.isError || undefined}
      >
        <summary>
          {node.call?.name ?? "工具"} · {node.isError ? "执行失败" : "查看结果"}
        </summary>
        <pre className="opc-disclosureBody">{text}</pre>
      </details>
    );
  }
  if (node.kind === "turn-error")
    return (
      <div className="opc-message" data-error="true">
        <small className="opc-messageLabel">失败</small>
        {node.message}
      </div>
    );
  if (node.kind === "assistant") {
    return (
      <>
        {node.blocks.map((block, index) => {
          if (block.kind === "text" && block.text !== "")
            return (
              <div className="opc-message" data-role="assistant" key={index}>
                <MarkdownText text={block.text} codeLabels={MARKDOWN_LABELS} />
              </div>
            );
          if (block.kind === "reasoning" && block.text !== "")
            return (
              <details className="opc-disclosure" key={index}>
                <summary>思考 · 点击展开</summary>
                <div className="opc-disclosureBody">
                  <MarkdownText
                    text={block.text}
                    codeLabels={MARKDOWN_LABELS}
                  />
                </div>
              </details>
            );
          if (block.kind === "tool-call")
            return (
              <details className="opc-disclosure" key={index}>
                <summary>{block.name || "工具"} · 调用详情</summary>
                <pre className="opc-disclosureBody">
                  {block.argsRaw || "无参数"}
                </pre>
              </details>
            );
          if (block.kind === "other")
            return (
              <details className="opc-disclosure" key={index}>
                <summary>其他消息 · 点击展开</summary>
                <pre className="opc-disclosureBody">
                  {JSON.stringify(block.block, null, 2)}
                </pre>
              </details>
            );
          if (block.kind === "image")
            return (
              <div className="opc-message" data-role="assistant" key={index}>
                图片附件
              </div>
            );
          return null;
        })}
      </>
    );
  }
  if (node.kind === "user" || node.kind === "steering") {
    const text = node.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    return text === "" ? null : (
      <div className="opc-message" data-role="user">
        <small className="opc-messageLabel">
          {node.kind === "steering" ? "补充指令" : "指令"}
        </small>
        <MarkdownText text={text} codeLabels={MARKDOWN_LABELS} />
      </div>
    );
  }
  return null;
}

export function OfficePanel({
  onExit,
  onSendPrompt,
  onConversation,
}: {
  onExit(): void;
  onSendPrompt(sessionId: string, text: string): Promise<void>;
  onConversation(
    sessionId: string,
  ): ObservableSnapshot<{ nodes: readonly ConversationNode[] }> | undefined;
}): JSX.Element {
  ensureStyle();
  const [store] = useState(() => new SessionStore());
  const [snapshot, setSnapshot] = useState(store.snapshot);
  const [manifest, setManifest] = useState<CharacterManifest>();
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string>();
  const [history, setHistory] = useState<readonly ConversationNode[]>([]);
  const [officeTime, setOfficeTime] = useState<OfficeTime>(() =>
    officeTimeAt(),
  );
  useEffect(() => {
    const stop = store.subscribe(() => setSnapshot(store.snapshot));
    store.start();
    return () => {
      stop();
      store.stop();
    };
  }, [store]);
  useEffect(() => {
    const refresh = (): void => setOfficeTime(officeTimeAt());
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const loadManifest = useCallback((): void => {
    void fetch("/dsh-opc/v1/assets/manifest.json")
      .then((response) => response.json())
      .then(setManifest)
      .catch(() => {});
  }, []);
  useEffect(loadManifest, []);
  const sessions = snapshot?.sessions ?? [];
  const visibleSessions = sessions.slice(0, 6);
  const selected = sessions.find((session) => session.id === selectedId);
  const [chatAnimationFailed, setChatAnimationFailed] = useState(false);
  const chatAnimation = useMemo(
    () =>
      selected === undefined
        ? undefined
        : animationUrl(selected.character, selected.state, manifest),
    [
      selected?.id,
      selected?.character,
      selected?.state,
      selected?.stateSince,
      manifest,
    ],
  );
  useEffect(() => setChatAnimationFailed(false), [chatAnimation]);
  useEffect(() => {
    if (selected === undefined) {
      setHistory([]);
      return;
    }
    const source = onConversation(selected.id);
    if (source === undefined) {
      setHistory([]);
      return;
    }
    const update = (): void => setHistory(source.getSnapshot().nodes);
    update();
    return source.subscribe(update);
  }, [selected?.id, onConversation]);
  const send = async (): Promise<void> => {
    if (selected === undefined || draft.trim() === "" || sending) return;
    setSending(true);
    setResult(undefined);
    try {
      await onSendPrompt(selected.id, draft.trim());
      setDraft("");
      setResult("指令已加入任务队列。");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "发送指令失败。");
    } finally {
      setSending(false);
    }
  };
  return (
    <main className="opc-office">
      <header className="opc-topbar">
        <div className="opc-mark">
          <span aria-hidden="true">✦</span> 深度工坊 <b>作战室</b>
        </div>
        <button type="button" className="opc-exit" onClick={onExit}>
          返回 DSH
        </button>
      </header>
      <div className="opc-stage">
        <AssetPrompt onInstalled={loadManifest} />
        <section
          className={`opc-floor opc-time-${officeTime}`}
          style={
            {
              ...OFFICE_SHADERS[officeTime].style,
              "--opc-office-background": `url("${OFFICE_SHADERS[officeTime].background}")`,
            } as CSSProperties
          }
        >
          {Array.from({ length: 6 }, (_, index) => {
            const session = visibleSessions[index];
            const anchor = OFFICE_SHADERS[officeTime].seats[index];
            if (anchor === undefined) return null;
            const seatStyle = {
              "--opc-seat-x": `${anchor.x}%`,
              "--opc-seat-y": `${anchor.y}%`,
              "--opc-seat-scale": anchor.scale,
            } as CSSProperties;
            return session === undefined ? (
              <EmptySeat
                key={`empty-${index}`}
                number={index + 1}
                seatStyle={seatStyle}
              />
            ) : (
              <Worker
                key={session.id}
                session={session}
                manifest={manifest}
                selected={selected?.id === session.id}
                seatStyle={seatStyle}
                onSelect={() => {
                  setSelectedId(session.id);
                  setResult(undefined);
                }}
              />
            );
          })}
        </section>
        {selected === undefined ? null : (
          <aside className="opc-comms" role="dialog" aria-label="角色通讯记录">
            <div className="opc-commsHeader">
              <div>
                <p>角色通讯 · 真实记录</p>
                <h2>{selected.title}</h2>
              </div>
              <button
                type="button"
                className="opc-chatClose"
                onClick={() => setSelectedId(undefined)}
              >
                关闭通讯
              </button>
            </div>
            <div className="opc-commsMain">
              <div className="opc-dialogue">
                {history.length === 0 ? (
                  <div className="opc-message" data-role="assistant">
                    <small className="opc-messageLabel">
                      {selected.character} · {LABELS[selected.state]}
                    </small>
                    频道已接通，等待第一条记录。
                  </div>
                ) : (
                  history.map((node) => (
                    <ConversationEntry key={node.seq} node={node} />
                  ))
                )}
              </div>
              <div
                className="opc-chatActor"
                style={OFFICE_SHADERS[officeTime].style}
              >
                {chatAnimationFailed || chatAnimation === undefined ? (
                  <div
                    className="opc-fallback"
                    role="img"
                    aria-label="角色动画不可用"
                  >
                    ◉
                  </div>
                ) : (
                  <video
                    key={chatAnimation}
                    className="opc-chatActorVideo"
                    src={chatAnimation}
                    muted
                    playsInline
                    autoPlay
                    loop
                    onError={() => setChatAnimationFailed(true)}
                  />
                )}
                <div className="opc-chatActorHud">
                  <strong>{selected.character}</strong>
                  <small>{LABELS[selected.state]}</small>
                </div>
              </div>
            </div>
            <form
              className="opc-order"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                disabled={sending}
                placeholder={`向 ${selected.character} 下达指令…`}
              />
              <div className="opc-orderRow">
                <span>回车发送 · Shift + 回车换行</span>
                <button
                  className="opc-send"
                  type="submit"
                  disabled={draft.trim() === "" || sending}
                >
                  {sending ? "发送中…" : "下达指令"}
                </button>
              </div>
              {result !== undefined ? (
                <p className="opc-result" role="status">
                  {result}
                </p>
              ) : null}
            </form>
          </aside>
        )}
      </div>
    </main>
  );
}
