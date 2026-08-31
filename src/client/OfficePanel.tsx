import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { MarkdownText } from "@deepseek-ai/dsh-client-ui-primitives";
import { characterForModel } from "../protocol.ts";
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
import type { OfficeModelState, OfficeSessionList } from "./index.ts";
import {
  OFFICE_SEAT_ORDER,
  OFFICE_SHADERS,
  officeTimeAt,
  type OfficeTime,
} from "./office-shaders.ts";

// A focused, full-screen "command room" rather than a dashboard: the scene is
// the primary surface, and the selected character is the person being briefed.
const OFFICE_CSS = `.opc-office{min-height:100vh;color:#f8e9c5;background:#111620;background-image:linear-gradient(#ffffff05 1px,transparent 1px),linear-gradient(90deg,#ffffff05 1px,transparent 1px),radial-gradient(circle at 50% -20%,#465171 0,#161b29 50%,#0a0d15 100%);background-size:24px 24px,24px 24px,auto;font-family:"Microsoft YaHei",ui-rounded,system-ui,sans-serif;overflow:auto}.opc-office *{box-sizing:border-box}.opc-topbar{height:58px;padding:0 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #c48d43;background:#111827e8;box-shadow:0 3px #0008}.opc-mark{display:flex;align-items:center;gap:10px;color:#ffe1a0;font-weight:900;letter-spacing:.12em}.opc-mark b{color:#8dd8d1}.opc-exit{border:2px solid #946c3a;background:#251d24;color:#f6dba0;padding:7px 14px;box-shadow:inset 0 0 0 2px #ffffff0d,2px 2px #080a11;cursor:pointer;font:700 13px inherit}.opc-exit:hover{background:#3c2931}.opc-stage{max-width:1500px;min-height:calc(100vh - 58px);margin:auto;padding:18px;display:grid;grid-template-rows:auto minmax(500px,1fr) auto;gap:12px}.opc-sceneTitle{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-left:5px solid #e9b75b;background:#101522cc}.opc-sceneTitle h1{margin:0;color:#fff0c9;font-size:24px;letter-spacing:.1em}.opc-sceneTitle p{margin:0;color:#a8c6d4;font-size:12px}.opc-assets{display:flex;flex-wrap:wrap;gap:7px;padding:9px 12px;border:1px solid #d6a84d;background:#523c21;color:#fff0bd;font-size:12px}.opc-assets strong{width:100%}.opc-assets code{color:#fff}.opc-assets progress{width:100%;height:7px;accent-color:#ffd36b}.opc-floor{position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(3,minmax(145px,1fr));gap:10px;min-height:0;padding:14px;border:2px solid #596078;background:linear-gradient(135deg,#30394cbb,#202737bb),repeating-linear-gradient(45deg,#fff1 0 1px,transparent 1px 12px);box-shadow:inset 0 0 0 3px #111621,inset 0 0 55px #0008}.opc-worker,.opc-emptySeat{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-height:0;padding:7px;border:2px solid #435069;background:linear-gradient(180deg,#263449,#19202f 65%,#121722);color:inherit;box-shadow:inset 0 0 0 1px #ffffff0c,3px 3px #090c13;overflow:hidden;font:inherit;text-align:center}.opc-worker{cursor:pointer;transition:transform .12s ease,border-color .12s ease,filter .12s ease}.opc-worker:hover,.opc-worker:focus-visible,.opc-worker[data-selected=true]{z-index:1;transform:translate(-2px,-2px);border-color:#ffce6c;filter:brightness(1.17);outline:none}.opc-worker[data-selected=true]:after{content:"指令中";position:absolute;top:6px;left:6px;padding:2px 5px;background:#f5be58;color:#251810;font-size:10px;font-weight:900}.opc-emptySeat{justify-content:center;border-style:dashed;color:#708096;background:#151b28aa}.opc-emptySeat span{font-size:28px}.opc-monitor{position:relative;z-index:1;width:100%;padding:4px 7px;overflow:hidden;border-bottom:1px solid #6d8099;color:#d9f5ff;background:#172535;font-size:11px}.opc-monitor span,.opc-monitor small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.opc-monitor small,.opc-worker>small{color:#aab7ca}.opc-video,.opc-fallback{display:block;width:100%;height:clamp(86px,14vh,145px);object-fit:contain}.opc-fallback{padding-top:22px;color:#ffdc81;font-size:52px}.opc-worker strong{position:relative;z-index:1;color:#ffe9bc;font-size:13px}.opc-state{position:relative;z-index:1;margin-top:3px;color:#9ad9d2;font-size:11px}.opc-attention{position:absolute;z-index:2;top:5px;right:5px;display:grid;place-items:center;width:21px;height:21px;border:2px solid #351922;border-radius:50%;color:#fff;background:#dd5d62;font-weight:900}.opc-await{border-color:#e6b552}.opc-error{border-color:#d86b6a}.opc-comms{display:grid;grid-template-columns:205px minmax(0,1fr);min-height:210px;border:2px solid #6c5f62;background:#171520;box-shadow:inset 0 0 0 2px #ffffff0b,4px 4px #080b11}.opc-commsHeader{padding:16px;border-right:2px solid #6c5f62;background:linear-gradient(155deg,#493244,#261f31)}.opc-commsHeader p,.opc-commsHeader h2{margin:0}.opc-commsHeader p{color:#f7c973;font-size:11px;letter-spacing:.16em}.opc-commsHeader h2{margin-top:7px;color:#fff2d2;font-size:19px}.opc-dialogue{display:flex;gap:9px;overflow:auto;padding:14px 14px 0;min-width:0;max-height:140px}.opc-speech{flex:none;max-width:350px;padding:11px 14px;border:1px solid #d5a550;background:#33263a;color:#f5e7d0;box-shadow:3px 3px #0b0b11;line-height:1.55;font-size:14px;white-space:pre-wrap;overflow:hidden;text-overflow:ellipsis}.opc-speech[data-error=true]{border-color:#df7472;background:#48242d}.opc-speech small{display:block;margin-bottom:4px;color:#ffcf71;font-size:10px;letter-spacing:.08em}.opc-order{grid-column:2;padding:0 14px 13px}.opc-order textarea{display:block;width:100%;height:46px;resize:none;padding:11px;border:1px solid #8b7b80;background:#0d1018;color:#fff;font:inherit;line-height:1.45}.opc-order textarea:focus{outline:2px solid #f3c464}.opc-orderRow{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:7px;color:#a7a6b5;font-size:11px}.opc-send{border:2px solid #ffda88;background:#b95d3e;color:#fff7e7;padding:6px 15px;box-shadow:2px 2px #3b1e22;cursor:pointer;font:800 12px inherit}.opc-send:hover{background:#dc7650}.opc-send:disabled{opacity:.55;cursor:wait}.opc-result{margin:0;color:#ffb6ad;font-size:12px}@media(max-width:760px){.opc-topbar{padding:0 12px}.opc-stage{padding:8px;grid-template-rows:auto 500px auto}.opc-floor{gap:5px;padding:6px}.opc-comms{grid-template-columns:1fr}.opc-commsHeader{border-right:0;border-bottom:1px solid #6c5f62;padding:10px}.opc-order{grid-column:1}.opc-video,.opc-fallback{height:76px}.opc-sceneTitle h1{font-size:18px}}`;
// The generated environment is the office itself; the controls merely sit on
// top of it. This deliberately overrides the earlier generic panel geometry.
const GAME_CSS = `.opc-stage{position:relative;max-width:1660px;grid-template-rows:auto auto minmax(540px,1fr);padding:14px}.opc-floor{grid-row:3;aspect-ratio:16/9;min-height:auto;max-height:calc(100vh - 155px);padding:3.2% 7%;gap:0;border:4px solid #6a4f35;background:url('/dsh-opc/v1/assets/office-night.png') center/cover no-repeat;box-shadow:0 0 0 2px #17111a,0 14px 40px #000a}.opc-worker,.opc-emptySeat{border:0;background:transparent;box-shadow:none;border-radius:0;overflow:visible}.opc-worker{justify-content:flex-end;filter:none}.opc-worker:hover,.opc-worker:focus-visible,.opc-worker[data-selected=true]{transform:none;border:0;filter:none}.opc-worker[data-selected=true]:after{display:none}.opc-emptySeat{opacity:0}.opc-video,.opc-fallback{position:absolute;z-index:2;bottom:7%;left:18%;width:64%;height:78%;padding:0;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(2px 3px 0 #071018aa)}.opc-monitor{position:absolute;z-index:4;bottom:0;left:13%;width:74%;padding:3px 5px;border:1px solid #8aa9b7;background:#111b25df;box-shadow:2px 2px #0008}.opc-worker strong,.opc-worker>.opc-state,.opc-worker>small{display:none}.opc-attention{z-index:5;top:10%;right:16%}.opc-comms{position:fixed;z-index:20;inset:7vh 6vw 6vh;display:grid;grid-template-rows:78px minmax(0,1fr) auto;grid-template-columns:1fr;min-height:0;border:4px solid #e2b65d;background:#151727f8;box-shadow:0 0 0 4px #241923,0 20px 80px #000c}.opc-commsHeader{display:flex;align-items:center;justify-content:space-between;padding:15px 24px;border-right:0;border-bottom:3px solid #70544d;background:linear-gradient(90deg,#54384b,#27334c)}.opc-commsHeader h2{font-size:24px}.opc-chatClose{border:2px solid #e1ba6a;background:#2c2533;color:#ffe9bc;padding:7px 14px;box-shadow:2px 2px #080910;cursor:pointer;font:700 12px inherit}.opc-dialogue{display:flex;flex-direction:column;align-items:flex-start;gap:12px;overflow:auto;max-height:none;padding:24px 8%;background:linear-gradient(#101521cc,#101521cc),repeating-linear-gradient(0deg,transparent 0 30px,#ffffff06 30px 31px)}.opc-speech{flex:none;max-width:min(780px,85%);overflow:visible;padding:13px 17px;border:2px solid #d7ad5b;background:#32263a;box-shadow:4px 4px #080910;font-size:14px;white-space:pre-wrap}.opc-speech[data-error=true]{border-color:#ed8376;background:#562b35}.opc-order{grid-column:1;padding:16px 8%;border-top:3px solid #70544d;background:#1c1c2a}.opc-order textarea{height:72px;border:2px solid #9c826a;background:#090b12;font-size:14px}.opc-orderRow{font-size:12px}.opc-send{padding:9px 20px;font-size:13px}@media(max-width:760px){.opc-floor{padding:3.2% 7%;max-height:none}.opc-comms{inset:5vh 3vw}.opc-dialogue{padding:18px}.opc-order{padding:12px}.opc-commsHeader{padding:10px 14px}.opc-commsHeader h2{font-size:18px}.opc-video,.opc-fallback{height:75%}}`;
// The generated backgrounds are not geometrically identical. Anchor each
// worker to its hand-tuned workstation position instead of a CSS layout grid.
const ANCHOR_CSS = `.opc-floor{display:block;padding:0}.opc-worker,.opc-emptySeat{position:absolute;left:var(--opc-seat-x);top:var(--opc-seat-y);width:28%;aspect-ratio:1;min-height:0;padding:0;transform:translate(-50%,-90%) scale(var(--opc-seat-scale));transform-origin:center bottom}.opc-worker{z-index:3}.opc-worker:hover,.opc-worker:focus-visible,.opc-worker[data-selected=true]{z-index:8;transform:translate(-50%,-90%) scale(var(--opc-seat-scale))}.opc-emptySeat{z-index:2}.opc-video,.opc-fallback{inset:0;width:100%;height:100%}.opc-monitor{bottom:5%;left:8%;width:84%}@media(max-width:760px){.opc-floor{padding:0}.opc-video,.opc-fallback{height:100%}}`;
const SHADER_CSS = `.opc-floor{isolation:isolate;background-image:var(--opc-office-night)!important;background-position:center;background-size:cover;background-repeat:no-repeat}.opc-floor:after{content:'';position:absolute;z-index:10;inset:0;pointer-events:none;background:var(--opc-atmosphere);opacity:var(--opc-opacity);mix-blend-mode:var(--opc-blend);animation:opc-light-breathe 12s ease-in-out infinite alternate}.opc-video{filter:var(--opc-character-filter) drop-shadow(2px 3px 0 #071018aa)}@keyframes opc-light-breathe{from{opacity:calc(var(--opc-opacity) * .88)}to{opacity:var(--opc-opacity)}}@media(prefers-reduced-motion:reduce){.opc-floor:after{animation:none}}`;
const CHAT_CSS = `.opc-commsMain{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,34%);min-height:0;overflow:hidden}.opc-dialogue{display:flex;flex-direction:column;gap:14px;max-height:none;padding:24px 6%;background:#101521;scrollbar-color:#765f51 #0d111b}.opc-message{width:min(880px,94%);color:#e9e5df;line-height:1.7;font-size:14px}.opc-message[data-role="user"]{align-self:flex-end;padding:11px 14px;border-left:3px solid #748ca2;background:#1c2531}.opc-message[data-role="assistant"]{align-self:flex-start}.opc-message[data-error=true]{padding:11px 14px;border:1px solid #e06e6b;background:#51252d;color:#ffd5cf}.opc-messageLabel{display:block;margin-bottom:5px;color:#d9ad58;font:700 10px/1.4 ui-monospace,SFMono-Regular,monospace;letter-spacing:.08em}.opc-disclosure{width:min(880px,94%);border-top:1px solid #3b4654;color:#cbd0d8}.opc-disclosure summary{display:flex;align-items:center;gap:8px;padding:9px 2px;cursor:pointer;color:#aeb7c3;font-size:12px;list-style:none}.opc-disclosure summary::-webkit-details-marker{display:none}.opc-disclosure summary:before{content:'›';color:#d4a94f;font-size:18px;line-height:1;transition:transform .12s}.opc-disclosure[open] summary:before{transform:rotate(90deg)}.opc-disclosureBody{margin:0 0 10px 18px;padding:10px 12px;border-left:2px solid #4a5665;background:#0c111a;color:#bec6d0;line-height:1.55;font:12px/1.55 ui-monospace,SFMono-Regular,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.opc-disclosure[data-error=true]{border-color:#7d343b}.opc-disclosure[data-error=true] summary{color:#ff8f88}.opc-chatActor{position:relative;isolation:isolate;overflow:hidden;border-left:2px solid #70544d;background:radial-gradient(circle at 50% 26%,#5c4a6b66,transparent 42%),linear-gradient(180deg,#20293a,#111622)}.opc-chatActor:after{content:'';position:absolute;z-index:3;inset:0;pointer-events:none;background:var(--opc-atmosphere);opacity:var(--opc-opacity);mix-blend-mode:var(--opc-blend)}.opc-chatActorVideo{position:absolute;z-index:2;left:50%;bottom:-3%;width:min(46vw,520px);height:92%;object-fit:contain;transform:translateX(-50%);image-rendering:pixelated;filter:var(--opc-character-filter) drop-shadow(5px 8px 0 #05081299)}.opc-chatActorHud{position:absolute;z-index:5;right:14px;bottom:14px;left:14px;padding:9px 11px;border:1px solid #8aa9b7;background:#101925e8;box-shadow:3px 3px #07090e}.opc-chatActorHud strong,.opc-chatActorHud small{display:block}.opc-chatActorHud strong{color:#ffe7b1}.opc-chatActorHud small{margin-top:2px;color:#91cbc6}.opc-order{grid-column:1/-1}.opc-commsHeader{grid-column:1/-1}@media(max-width:820px){.opc-commsMain{grid-template-columns:1fr}.opc-chatActor{display:none}.opc-dialogue{padding:18px}.opc-message,.opc-disclosure{width:100%}}`;
const FULLSCREEN_CSS = `.opc-office{position:fixed;inset:0;min-height:0;overflow:hidden;background:#090c13}.opc-stage{position:absolute;inset:0;display:block;max-width:none;min-height:0;padding:0}.opc-floor{position:absolute;top:50%;left:50%;width:min(100vw,177.777vh);height:min(100vh,56.25vw);max-height:none;aspect-ratio:16/9;transform:translate(-50%,-50%);border:0;box-shadow:none}.opc-worker,.opc-emptySeat{z-index:3}.opc-worker[data-row="1"],.opc-emptySeat[data-row="1"]{z-index:3}.opc-worker[data-row="2"],.opc-emptySeat[data-row="2"]{z-index:4}.opc-exit{position:fixed;z-index:60;top:18px;left:18px;border-color:#e0b25c;background:#171b27e8;backdrop-filter:blur(7px)}.opc-comms{position:fixed;z-index:50;inset:0;grid-template-rows:72px minmax(0,1fr) auto;border:0;box-shadow:none}.opc-commsMain{grid-template-columns:minmax(0,1fr) minmax(260px,31vw) 210px}.opc-commsHeader{padding-left:82px}.opc-chatTools{display:flex;align-items:center;gap:12px}.opc-collapseToggle{display:flex;align-items:center;gap:8px;color:#d6d3ce;font-size:12px;cursor:pointer}.opc-collapseToggle input{width:17px;height:17px;accent-color:#d5a84e}.opc-conversationNode{display:contents}.opc-callNav{display:flex;flex-direction:column;min-width:0;padding:16px 10px;border-left:2px solid #383846;background:#0c0f16;overflow:hidden}.opc-callNavTitle{margin:0 4px 10px;color:#d4ad5d;font:700 10px/1.3 ui-monospace,SFMono-Regular,monospace;letter-spacing:.14em}.opc-callNavList{display:flex;flex:1;flex-direction:column;gap:2px;min-height:0;overflow:auto;scrollbar-width:none}.opc-callNavList::-webkit-scrollbar{display:none}.opc-callPoint{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 14px;gap:8px;align-items:center;width:100%;min-height:27px;padding:3px 4px;border:0;background:transparent;color:#8f929b;text-align:left;cursor:pointer;font:11px/1.25 "Microsoft YaHei",sans-serif}.opc-callPoint:hover,.opc-callPoint:focus-visible{color:#e8e1d5;outline:none}.opc-callPoint span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.opc-callPoint i{display:block;width:8px;height:3px;margin-left:auto;border-radius:2px;background:#484b53}.opc-callPoint[data-kind="user"]{color:#d8d9dd}.opc-callPoint[data-kind="tool-result"] i{background:#8b6e3e}.opc-callPoint[data-error=true] i{background:#d75d62}.opc-callPoint[data-active=true]{color:#71a8ff}.opc-callPoint[data-active=true] i{width:14px;background:#65a0ff}.opc-assets{position:fixed;z-index:70;right:18px;bottom:18px;width:min(520px,calc(100vw - 36px))}@media(max-width:1050px){.opc-commsMain{grid-template-columns:minmax(0,1fr) minmax(240px,34vw) 46px}.opc-callNav{padding:14px 7px}.opc-callNavTitle,.opc-callPoint span{display:none}.opc-callPoint{display:block;padding:5px}.opc-callPoint i{margin:auto}.opc-commsHeader{padding-left:76px}}@media(max-width:760px){.opc-chatActor{display:none}.opc-commsMain{grid-template-columns:minmax(0,1fr) 42px}.opc-callNav{grid-column:2}.opc-commsHeader{padding:10px 10px 10px 72px}.opc-chatTools{gap:6px}.opc-collapseToggle span{display:none}.opc-chatClose{padding:6px 8px}}`;

const CONVERSATION_NODE_CSS = `.opc-commsHeader{padding-left:140px}.opc-conversationNode{display:flex;flex-direction:column;align-items:flex-start;gap:8px;width:100%;scroll-margin:18px 0}.opc-conversationNode:has(.opc-message[data-role="user"]){align-items:flex-end}@media(max-width:760px){.opc-commsHeader{padding-left:72px}}`;
const UI_POLISH_CSS = `.opc-comms{grid-template-rows:64px minmax(0,1fr) auto;background:#0d111a}.opc-commsHeader{padding-top:8px;padding-bottom:8px;border-bottom:1px solid #604d48;background:linear-gradient(90deg,#372b3b,#222b40)}.opc-commsHeader p{font-size:9px}.opc-commsHeader h2{margin-top:2px;font-size:18px;line-height:1.2}.opc-commsMain{grid-template-columns:minmax(0,1fr) clamp(250px,22vw,360px) clamp(150px,12vw,210px)}.opc-dialogue{gap:10px;padding:22px max(28px,6vw);background:#0d131e}.opc-conversationNode{gap:6px}.opc-conversationNode:empty{display:none}.opc-message{width:min(820px,100%);font-size:14px}.opc-message[data-role="user"]{max-width:min(680px,88%);padding:9px 13px;background:#192433}.opc-disclosure{width:min(820px,100%)}.opc-disclosure summary{padding:7px 2px}.opc-chatActor{border-left:1px solid #4f4547;background-image:linear-gradient(#111827b8,#111827b8),var(--opc-office-night);background-position:center;background-size:cover}.opc-chatActorVideo{bottom:46px;width:min(100%,calc(100vh - 190px),480px);height:auto;aspect-ratio:1;object-fit:contain}.opc-chatActorHud{right:10px;bottom:10px;left:10px;padding:7px 9px;box-shadow:none}.opc-callNav{padding:12px 8px;border-left:1px solid #303640;background:#090d14}.opc-callNavTitle{margin-bottom:6px}.opc-callPoint{min-height:30px}.opc-order{padding:10px max(24px,8vw) 11px;border-top:1px solid #5d4b47;background:#151722}.opc-order textarea{height:50px;padding:12px 14px;border:1px solid #7b685b}.opc-orderRow{margin-top:5px}.opc-send{padding:7px 16px}.opc-chatClose{padding:6px 10px;box-shadow:none}.opc-collapseToggle{padding:5px 8px;border:1px solid #4b5360;background:#171d28}.opc-exit{top:12px;left:14px;padding:7px 11px;box-shadow:none}@media(max-width:1050px){.opc-commsMain{grid-template-columns:minmax(0,1fr) 280px 44px}.opc-chatActorVideo{width:min(100%,calc(100vh - 190px))}}@media(max-width:760px){.opc-comms{grid-template-rows:58px minmax(0,1fr) auto}.opc-dialogue{padding:16px}.opc-order{padding:8px 12px}.opc-order textarea{height:46px}}`;
const FINAL_UI_CSS = `.opc-commsHeader{padding:10px 20px}.opc-commsMain{position:relative;grid-template-columns:minmax(0,1fr) clamp(250px,23vw,380px)}.opc-chatActor{appearance:none;padding:0;border-top:0;border-right:0;border-bottom:0;color:inherit;text-align:left;cursor:pointer}.opc-chatActor:hover .opc-chatActorVideo,.opc-chatActor:focus-visible .opc-chatActorVideo{filter:var(--opc-character-filter) brightness(1.12) drop-shadow(5px 8px 0 #05081299)}.opc-chatActor:focus-visible{outline:2px solid #e2b65d;outline-offset:-2px}.opc-callNav{position:absolute;z-index:8;top:12px;right:12px;bottom:12px;width:min(210px,17vw);padding:11px 8px;border:1px solid #3b4654;background:#080d15e8;box-shadow:0 8px 28px #0009;backdrop-filter:blur(8px)}.opc-callNavList{mask-image:linear-gradient(#000 92%,transparent)}@media(max-width:1050px){.opc-commsMain{grid-template-columns:minmax(0,1fr) 270px}.opc-callNav{width:44px;padding:9px 6px}.opc-callNavTitle,.opc-callPoint span{display:none}.opc-callPoint{display:block;padding:5px}.opc-callPoint i{margin:auto}}@media(max-width:760px){.opc-commsHeader{padding:8px 12px}.opc-commsMain{grid-template-columns:minmax(0,1fr)}.opc-callNav{right:8px;top:8px;bottom:8px;width:40px}}`;

function ensureStyle(): void {
  if (document.querySelector("#dsh-opc-style") !== null) return;
  const style = document.createElement("style");
  style.id = "dsh-opc-style";
  style.textContent =
    OFFICE_CSS +
    GAME_CSS +
    SHADER_CSS +
    ANCHOR_CSS +
    CHAT_CSS +
    FULLSCREEN_CSS +
    CONVERSATION_NODE_CSS +
    UI_POLISH_CSS +
    FINAL_UI_CSS +
    `.opc-worker[data-row="1"] .opc-monitor{top:0;bottom:auto;left:50%;transform:translate(-50%,-100%)}` +
    // 聊天面板：角色动画放到左侧列，对话在右侧；对话雷达半透明不遮住后面。
    `.opc-commsMain{grid-template-columns:clamp(250px,23vw,380px) minmax(0,1fr)}.opc-chatActor{order:-1}.opc-callNav{background:rgba(8,13,21,.55);backdrop-filter:blur(3px)}@media(max-width:760px){.opc-commsMain{grid-template-columns:1fr}}` +
    // 运行中工位的"正在跑"呼吸脉冲：名牌边框发光，让等待型工具一眼可辨。
    `.opc-monitor{transition:border-color .3s,box-shadow .3s}.opc-worker[data-running] .opc-monitor{border-color:#ffce6c;animation:opc-run-pulse 1.8s ease-in-out infinite}.opc-worker[data-running] .opc-monitor small{color:#ffd9a0}@keyframes opc-run-pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,206,108,.35)}50%{box-shadow:0 0 0 7px rgba(255,206,108,0)}}`;
  document.head.append(style);
}

// 空闲会话超过这个时长没有任何消息往来，就从办公室界面隐藏（工位显示为空闲）。
// 判断基准取“最后活动时间”（会话列表行的 updatedAt，回退到快照的 stateSince），
// 正在运行/待授权/出错的会话始终保留显示。
const OFFICE_INACTIVE_MS = 24 * 60 * 60 * 1000;

function shouldShowInOffice(
  session: SessionView,
  lastActivity: number | undefined,
): boolean {
  if (session.state !== "idle") return true;
  if (lastActivity === undefined) return true;
  return Date.now() - lastActivity <= OFFICE_INACTIVE_MS;
}

const LABELS: Record<SessionState, string> = {
  idle: "待命中",
  thinking: "思考中",
  reading: "阅读中",
  writing: "编写中",
  await: "等待授权",
  error: "发生错误",
};

/** Compact elapsed time, e.g. 12s / 3m 41s / 1h 05m. */
function formatDuration(start: number, now: number): string {
  const sec = Math.max(0, Math.floor((now - start) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${String(min % 60).padStart(2, "0")}m`;
}

// 工位按“最后一次对话/活动时间”倒序展示：最近有往来的会话排在最前面，
// 这样正在运行、刚被操作过的会话自然会进入可见工位。
export function animationUrl(
  character: string,
  state: SessionState,
  manifest: CharacterManifest | undefined,
  revision?: string,
): string {
  const resolvedCharacter = characterName(character, manifest);
  const exactFiles =
    manifest?.characters?.[resolvedCharacter]?.states[state] ??
    manifest?.characters?.[manifest?.fallbackCharacter ?? ""]?.states[state] ??
    [];
  const selected =
    exactFiles[Math.floor(Math.random() * exactFiles.length)] ??
    `${state}-0.webm`;
  const url = `/dsh-opc/v1/assets/characters/${encodeURIComponent(resolvedCharacter)}/${encodeURIComponent(selected)}`;
  return revision === undefined
    ? url
    : `${url}?revision=${encodeURIComponent(revision)}`;
}

function characterName(
  character: string,
  manifest: CharacterManifest | undefined,
): string {
  if (manifest?.characters === undefined) return character;
  if (manifest.characters[character] !== undefined) return character;
  if (manifest.characters[manifest.fallbackCharacter] !== undefined)
    return manifest.fallbackCharacter;
  return Object.keys(manifest.characters)[0] ?? character;
}

export function sessionCharacter(
  session: SessionView,
  manifest: CharacterManifest | undefined,
): string {
  if (manifest === undefined) return session.character;
  // Resolve from the front-end manifest by model, so the shown character tracks
  // the actual model even when the host snapshot carried a stale character
  // (e.g. fallback before a model mapping was added).
  return characterName(characterForModel(session.model, manifest), manifest);
}

/**
 * A single character loop. Each instance picks a pseudo-random start frame
 * once its duration is known, so a freshly opened office does not play every
 * worker in sync. The video stays invisible until it actually has a decodable
 * frame, which removes the brief transparent/blank flash that a plain <video>
 * shows while its WebM is still loading.
 */
export function LoopVideo({
  src,
  onError,
  className,
  style,
}: {
  src: string;
  onError?: () => void;
  className?: string;
  style?: CSSProperties;
}): JSX.Element {
  const ref = useRef<HTMLVideoElement>(null);
  const seeded = useRef(false);
  useEffect(() => {
    seeded.current = false;
    const video = ref.current;
    if (video === null) return;
    const seed = (): void => {
      if (seeded.current) return;
      seeded.current = true;
      const duration = video.duration;
      if (Number.isFinite(duration) && duration > 0)
        video.currentTime = Math.random() * duration;
    };
    video.addEventListener("loadeddata", seed);
    video.addEventListener("canplay", seed);
    return () => {
      video.removeEventListener("loadeddata", seed);
      video.removeEventListener("canplay", seed);
    };
  }, [src]);
  return (
    <video
      ref={ref}
      className={className}
      src={src}
      muted
      playsInline
      autoPlay
      loop
      onError={onError}
      preload="auto"
      style={style}
    />
  );
}

function Worker({
  session,
  manifest,
  selected,
  row,
  seatStyle,
  onSelect,
}: {
  session: SessionView;
  manifest: CharacterManifest | undefined;
  selected: boolean;
  row: number;
  seatStyle: CSSProperties;
  onSelect(): void;
}) {
  const character = sessionCharacter(session, manifest);
  const [failed, setFailed] = useState(false);
  const [source, setSource] = useState(() =>
    animationUrl(character, session.state, manifest),
  );
  const [hasRetried, setHasRetried] = useState(false);
  useEffect(() => {
    setFailed(false);
    setHasRetried(false);
    setSource(animationUrl(character, session.state, manifest));
  }, [session.id, session.state, session.stateSince, character, manifest]);
  const handleVideoError = (): void => {
    if (hasRetried) {
      setFailed(true);
      return;
    }
    // Asset installation and browser decoding can race on the first request.
    // Retry once with a cache-busting query before showing the permanent
    // fallback marker for a genuinely unavailable clip.
    const separator = source.includes("?") ? "&" : "?";
    const retry = `${source}${separator}retry=${Date.now()}`;
    setHasRetried(true);
    setSource(retry);
  };
  const attention = session.state === "await" || session.state === "error";
  const running = session.runningSince !== undefined;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  const elapsed =
    running && session.runningSince !== undefined
      ? formatDuration(session.runningSince, now)
      : undefined;
  return (
    <button
      type="button"
      className={`opc-worker opc-${session.state}`}
      data-row={row}
      data-selected={selected || undefined}
      data-running={running || undefined}
      style={seatStyle}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`与 ${session.title} 通讯，${LABELS[session.state]}`}
    >
      <div className="opc-monitor">
        <span>{session.title}</span>
        <small>
          {running && session.runningSince !== undefined
            ? `${session.activeTool ?? "运行中"} · ${elapsed}`
            : LABELS[session.state]}
        </small>
      </div>
      {failed ? (
        <div className="opc-fallback" role="img" aria-label="角色动画不可用">
          ◉
        </div>
      ) : (
        <LoopVideo
          className="opc-video"
          src={source}
          onError={handleVideoError}
        />
      )}
      <strong>{character}</strong>
      <span className="opc-state">{LABELS[session.state]}</span>
      {attention ? <span className="opc-attention">!</span> : null}
    </button>
  );
}

function EmptySeat({
  number,
  row,
  seatStyle,
}: {
  number: number;
  row: number;
  seatStyle: CSSProperties;
}): JSX.Element {
  return (
    <div
      className="opc-emptySeat"
      data-row={row}
      aria-label={`空闲工位 ${number}`}
      style={seatStyle}
    >
      <span aria-hidden="true">＋</span>
      <small>空闲工位</small>
    </div>
  );
}

const MARKDOWN_LABELS = { copyLabel: "复制", copiedLabel: "已复制" };

function ConversationEntry({
  node,
  hideSuccessfulTools,
  successfulToolCallIds,
}: {
  node: ConversationNode;
  hideSuccessfulTools: boolean;
  successfulToolCallIds: ReadonlySet<string>;
}): JSX.Element | null {
  if (node.kind === "tool-result") {
    if (hideSuccessfulTools && !node.isError) return null;
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
          if (block.kind === "reasoning" && block.text !== "") {
            if (hideSuccessfulTools) return null;
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
          }
          if (block.kind === "tool-call") {
            if (hideSuccessfulTools && successfulToolCallIds.has(block.callId))
              return null;
            return (
              <details className="opc-disclosure" key={index}>
                <summary>{block.name || "工具"} · 调用详情</summary>
                <pre className="opc-disclosureBody">
                  {block.argsRaw || "无参数"}
                </pre>
              </details>
            );
          }
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

function conversationPointLabel(node: ConversationNode): string {
  if (node.kind === "user" || node.kind === "steering") {
    const text = node.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join(" ")
      .trim();
    return text || (node.kind === "steering" ? "补充指令" : "用户指令");
  }
  if (node.kind === "assistant") {
    const text = node.blocks.find(
      (
        block,
      ): block is Extract<(typeof node.blocks)[number], { kind: "text" }> =>
        block.kind === "text" && block.text.trim() !== "",
    );
    const tool = node.blocks.find((block) => block.kind === "tool-call");
    return (
      text?.text.trim() ||
      (tool?.kind === "tool-call" ? `调用 ${tool.name || "工具"}` : "助手回复")
    );
  }
  if (node.kind === "tool-result")
    return `${node.call?.name ?? "工具"} · ${node.isError ? "失败" : "完成"}`;
  if (node.kind === "turn-error") return `失败 · ${node.message}`;
  return node.kind;
}

function ConversationNav({
  nodes,
  activeSeq,
  onJump,
}: {
  nodes: readonly ConversationNode[];
  activeSeq: number | undefined;
  onJump(seq: number): void;
}): JSX.Element {
  const userNodes = nodes.filter(
    (node) => node.kind === "user" || node.kind === "steering",
  );
  return (
    <nav className="opc-callNav" aria-label="对话节点导航">
      <p className="opc-callNavTitle">对话雷达</p>
      <div className="opc-callNavList">
        {userNodes.map((node) => (
          <button
            key={node.seq}
            type="button"
            className="opc-callPoint"
            data-kind={node.kind}
            data-active={activeSeq === node.seq || undefined}
            title={conversationPointLabel(node)}
            onClick={() => onJump(node.seq)}
          >
            <span>{conversationPointLabel(node)}</span>
            <i aria-hidden="true" />
          </button>
        ))}
      </div>
    </nav>
  );
}

export function OfficePanel({
  onOpenNative,
  onExit,
  onSendPrompt,
  onConversation,
  sessionList,
  archivedSessionIds,
  modelSelection,
}: {
  onOpenNative(sessionId: string): void;
  onExit(): void;
  onSendPrompt(sessionId: string, text: string): Promise<void>;
  onConversation(
    sessionId: string,
  ): ObservableSnapshot<{ nodes: readonly ConversationNode[] }> | undefined;
  sessionList: ObservableSnapshot<OfficeSessionList>;
  archivedSessionIds?: ObservableSnapshot<readonly string[]> | undefined;
  modelSelection(sessionId: string): ObservableSnapshot<OfficeModelState>;
}): JSX.Element {
  ensureStyle();
  const [store] = useState(() => new SessionStore());
  const [snapshot, setSnapshot] = useState(store.snapshot);
  const [catalog, setCatalog] = useState(() => sessionList.getSnapshot());
  const [archivedIds, setArchivedIds] = useState<ReadonlySet<string>>(
    () => new Set(archivedSessionIds?.getSnapshot() ?? []),
  );
  const [models, setModels] = useState<Record<string, string>>({});
  const [manifest, setManifest] = useState<CharacterManifest>();
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string>();
  const [history, setHistory] = useState<readonly ConversationNode[]>([]);
  const [historyBlank, setHistoryBlank] = useState(false);
  const dialogueRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [hideSuccessfulTools, setHideSuccessfulTools] = useState(true);
  const [activeConversationSeq, setActiveConversationSeq] = useState<number>();
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
    const update = (): void => setCatalog(sessionList.getSnapshot());
    update();
    return sessionList.subscribe(update);
  }, [sessionList]);
  useEffect(() => {
    if (archivedSessionIds === undefined) return;
    const update = (): void =>
      setArchivedIds(new Set(archivedSessionIds.getSnapshot()));
    update();
    return archivedSessionIds.subscribe(update);
  }, [archivedSessionIds]);
  useEffect(() => {
    const stops: Array<() => void> = [];
    const updateModel = (
      sessionId: string,
      source: ObservableSnapshot<OfficeModelState>,
    ): void => {
      const model = source.getSnapshot().current?.model;
      if (model === undefined) return;
      setModels((current) =>
        current[sessionId] === model
          ? current
          : { ...current, [sessionId]: model },
      );
    };
    const orderedIds =
      catalog.current === undefined
        ? catalog.ids
        : [
            catalog.current,
            ...catalog.ids.filter((id) => id !== catalog.current),
          ];
    for (const sessionId of orderedIds) {
      try {
        const source = modelSelection(sessionId);
        updateModel(sessionId, source);
        stops.push(source.subscribe(() => updateModel(sessionId, source)));
      } catch {
        // A session removed between the list snapshot and scope lookup is
        // simply omitted on the next catalog publication.
      }
    }
    return () => stops.forEach((stop) => stop());
  }, [catalog.ids, catalog.current, modelSelection]);
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
  const liveSessions = snapshot?.sessions ?? [];
  // 以 host 快照为权威会话源：归档标记由 observer 打在快照里，过滤才可靠。
  // 客户端会话列表(catalog)只用来补可读标题、模型名和工作区，不再决定工位集合，
  // 否则 catalog 里未归档/快照外的会话会把归档后仍凑满 6 个工位。
  const lastActivityById = new Map<string, number>();
  const registerLastActivity = (
    id: string,
    value: number | undefined,
  ): void => {
    if (value !== undefined) lastActivityById.set(id, value);
  };
  for (const session of liveSessions)
    registerLastActivity(
      session.id,
      catalog.byId[session.id]?.updatedAt ?? session.stateSince,
    );
  const sessionTitle = (session: SessionView, index: number): string => {
    const row = catalog.byId[session.id];
    return (
      row?.title?.trim() ||
      row?.displayTitle?.trim() ||
      (row?.blank ? "新会话" : `会话 ${index + 1}`)
    );
  };
  const sessions = liveSessions
    .map((session, index): SessionView => {
      const model = session.model || models[session.id] || "default";
      const row = catalog.byId[session.id];
      return {
        ...session,
        title: sessionTitle(session, index),
        model,
        character:
          manifest === undefined
            ? (session.character ?? "fallback")
            : characterForModel(model, manifest),
        ...(row?.cwd === undefined ? {} : { workspace: row.cwd }),
      };
    })
    .filter(
      (session) =>
        !session.archived &&
        !archivedIds.has(session.id) &&
        shouldShowInOffice(session, lastActivityById.get(session.id)),
    )
    .sort((left, right) => {
      const lastLeft = lastActivityById.get(left.id) ?? 0;
      const lastRight = lastActivityById.get(right.id) ?? 0;
      return lastRight - lastLeft;
    });
  const visibleSessions = sessions.slice(0, 6);
  const selected = sessions.find((session) => session.id === selectedId);
  const selectedCharacter =
    selected === undefined ? undefined : sessionCharacter(selected, manifest);
  const successfulToolCallIds = useMemo(
    () =>
      new Set(
        history
          .filter(
            (
              node,
            ): node is Extract<ConversationNode, { kind: "tool-result" }> =>
              node.kind === "tool-result" && !node.isError,
          )
          .map((node) => node.callId),
      ),
    [history],
  );
  const [chatAnimationFailed, setChatAnimationFailed] = useState(false);
  const chatAnimation = useMemo(
    () =>
      selected === undefined
        ? undefined
        : animationUrl(
            selectedCharacter ?? selected.character,
            selected.state,
            manifest,
          ),
    [
      selected?.id,
      selected?.character,
      selectedCharacter,
      selected?.state,
      selected?.stateSince,
      manifest,
    ],
  );
  useEffect(() => setChatAnimationFailed(false), [chatAnimation]);
  useEffect(() => setActiveConversationSeq(undefined), [selected?.id]);
  // 聊天记录默认贴在最新一条：打开会话、或底部有新消息时滚到底。
  // 用户手动往上翻时不打扰（记录是否贴底）。
  useEffect(() => {
    atBottomRef.current = true;
    requestAnimationFrame(() => {
      const el = dialogueRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [selected?.id]);
  useEffect(() => {
    if (!atBottomRef.current) return;
    const el = dialogueRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history]);
  useEffect(() => {
    if (selected === undefined) {
      setHistory([]);
      setHistoryBlank(false);
      return;
    }
    const source = onConversation(selected.id);
    if (source === undefined) {
      setHistory([]);
      setHistoryBlank(false);
      return;
    }
    const apply = (): void => {
      const snap = (
        source as unknown as {
          getSnapshot(): {
            nodes: readonly ConversationNode[];
            blank: boolean;
          };
        }
      ).getSnapshot();
      setHistory(snap.nodes);
      setHistoryBlank(snap.blank);
    };
    apply();
    return source.subscribe(apply);
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
      <button
        type="button"
        className="opc-exit"
        aria-label="返回"
        onClick={onExit}
      >
        ← 返回
      </button>
      <div className="opc-stage">
        <section
          className={`opc-floor opc-time-${officeTime}`}
          style={
            {
              ...OFFICE_SHADERS[officeTime].style,
              "--opc-office-night": `url("${OFFICE_SHADERS[officeTime].background}")`,
            } as CSSProperties
          }
        >
          {OFFICE_SEAT_ORDER.map((seat, index) => {
            const session = visibleSessions[index];
            const anchor = OFFICE_SHADERS[officeTime].seats[seat.anchor];
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
                row={seat.row}
                seatStyle={seatStyle}
              />
            ) : (
              <Worker
                key={session.id}
                session={session}
                manifest={manifest}
                selected={selected?.id === session.id}
                row={seat.row}
                seatStyle={seatStyle}
                onSelect={() => onOpenNative(session.id)}
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
              <div className="opc-chatTools">
                <label className="opc-collapseToggle">
                  <input
                    type="checkbox"
                    checked={hideSuccessfulTools}
                    onChange={(event) =>
                      setHideSuccessfulTools(event.target.checked)
                    }
                  />
                  <span>隐藏成功的工具调用</span>
                </label>
              </div>
            </div>
            <div className="opc-commsMain">
              <div
                className="opc-dialogue"
                ref={dialogueRef}
                onScroll={() => {
                  const el = dialogueRef.current;
                  if (el)
                    atBottomRef.current =
                      el.scrollHeight - el.scrollTop - el.clientHeight < 48;
                }}
              >
                {history.length === 0 ? (
                  <div className="opc-message" data-role="assistant">
                    <small className="opc-messageLabel">
                      {selectedCharacter} · {LABELS[selected.state]}
                    </small>
                    {historyBlank ? "暂无记录。" : "正在加载对话，请稍候…"}
                  </div>
                ) : (
                  history.map((node) => (
                    <section
                      className="opc-conversationNode"
                      id={`opc-node-${String(node.seq).replace(".", "-")}`}
                      key={node.seq}
                    >
                      <ConversationEntry
                        node={node}
                        hideSuccessfulTools={hideSuccessfulTools}
                        successfulToolCallIds={successfulToolCallIds}
                      />
                    </section>
                  ))
                )}
              </div>
              <button
                type="button"
                className="opc-chatActor"
                aria-label="返回办公室"
                onClick={() => setSelectedId(undefined)}
                style={
                  {
                    ...OFFICE_SHADERS[officeTime].style,
                    "--opc-office-night": `url("${OFFICE_SHADERS[officeTime].background}")`,
                  } as CSSProperties
                }
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
                  <LoopVideo
                    className="opc-chatActorVideo"
                    src={chatAnimation}
                    onError={() => setChatAnimationFailed(true)}
                  />
                )}
                <div className="opc-chatActorHud">
                  <strong>{selectedCharacter}</strong>
                  <small>{LABELS[selected.state]}</small>
                </div>
              </button>
              <ConversationNav
                nodes={history}
                activeSeq={activeConversationSeq}
                onJump={(seq) => {
                  setActiveConversationSeq(seq);
                  document
                    .getElementById(`opc-node-${String(seq).replace(".", "-")}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              />
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
                placeholder={`向 ${selectedCharacter} 下达指令…`}
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
