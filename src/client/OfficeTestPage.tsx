import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { CharacterManifest, SessionState } from "../protocol.ts";
import { animationUrl } from "./OfficePanel.tsx";
import { OFFICE_SHADERS, type OfficeTime } from "./office-shaders.ts";

const STATES: readonly SessionState[] = [
  "idle",
  "thinking",
  "reading",
  "writing",
  "waiting_job",
  "waiting_permission",
  "error",
];
const STATE_LABELS: Record<SessionState, string> = {
  idle: "待命",
  thinking: "思考",
  reading: "阅读",
  writing: "编写",
  waiting_job: "等待任务",
  waiting_permission: "等待授权",
  error: "错误",
};
const TIMES: readonly OfficeTime[] = [
  "morning",
  "noon",
  "afternoon",
  "evening",
  "night",
];

const TEST_CSS = `.opc-test{min-height:100vh;padding:22px;color:#fff1c7;background:#10131b;font-family:"Microsoft YaHei",ui-rounded,system-ui,sans-serif}.opc-test *{box-sizing:border-box}.opc-testHead{max-width:1440px;margin:0 auto 14px;padding:16px 20px;border:3px solid #88633b;background:#171928e8;box-shadow:5px 5px #08090e}.opc-testHead h1,.opc-testHead p{margin:0}.opc-testHead h1{font-size:24px;letter-spacing:.12em}.opc-testHead p{margin-top:7px;color:#aec8d5;font-size:13px}.opc-testControls{display:grid;gap:9px;max-width:1440px;margin:auto auto 14px;padding:13px;border:2px solid #5d6c7e;background:#131b27e8}.opc-testControls section{display:flex;flex-wrap:wrap;align-items:center;gap:7px}.opc-testControls b{min-width:64px;color:#e5b95f;font-size:12px}.opc-testControls button{border:2px solid #596a7c;background:#202a38;color:#dbe9f4;padding:6px 10px;cursor:pointer;font:700 12px inherit}.opc-testControls button[data-active=true]{border-color:#ffd36b;background:#78502d;color:#fff3cb;box-shadow:2px 2px #08090e}.opc-testFloor{position:relative;isolation:isolate;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;max-width:1440px;min-height:calc(100vh - 220px);margin:auto;padding:34px;border:4px solid #6a4f35;background-image:var(--opc-office-background);background-position:center;background-size:cover;background-repeat:no-repeat;box-shadow:0 0 0 2px #17111a,0 14px 40px #000a}.opc-testFloor:before{content:"";position:absolute;z-index:1;inset:0;pointer-events:none;background:var(--opc-atmosphere);opacity:var(--opc-opacity);mix-blend-mode:var(--opc-blend)}.opc-testCard{position:relative;z-index:2;min-height:300px;border:3px solid #795c40;background:#121722c9;box-shadow:4px 4px #07090e;overflow:hidden}.opc-testCard header{display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:2px solid #806142;background:#242333e8;font-size:12px}.opc-testCard header small{color:#a9d9d4}.opc-testVideo{display:block;width:100%;height:250px;object-fit:contain;image-rendering:pixelated}.opc-testError{display:grid;place-items:center;height:250px;color:#ffb6a8;background:#35202a;font-size:13px}@media(max-width:700px){.opc-test{padding:10px}.opc-testFloor{padding:14px;grid-template-columns:1fr}.opc-testCard{min-height:240px}.opc-testVideo,.opc-testError{height:200px}}`;

function ensureTestStyle(): void {
  if (document.querySelector("#dsh-opc-test-style") !== null) return;
  const style = document.createElement("style");
  style.id = "dsh-opc-test-style";
  style.textContent = TEST_CSS;
  document.head.append(style);
}

export function OfficeTestPage(): JSX.Element {
  const [manifest, setManifest] = useState<CharacterManifest>();
  const [state, setState] = useState<SessionState>("idle");
  const [time, setTime] = useState<OfficeTime>("morning");
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    ensureTestStyle();
    if (new URLSearchParams(window.location.search).has("office-test")) {
      window.history.replaceState(null, "", "/office-test");
    }
    void fetch("/dsh-opc/v1/assets/manifest.json", { cache: "no-store" })
      .then((response) => response.json())
      .then((value: CharacterManifest) => setManifest(value))
      .catch(() => setManifest(undefined));
  }, []);

  const characters = Object.keys(manifest?.characters ?? {});
  const shader = OFFICE_SHADERS[time];
  return (
    <main className="opc-test">
      <header className="opc-testHead">
        <h1>动画渲染试验场</h1>
        <p>仅可通过地址访问，不会出现在导航中。切换状态和时段以检查 WebM 透明叠放效果。</p>
      </header>
      <nav className="opc-testControls" aria-label="动画预览控制">
        <section>
          <b>角色状态</b>
          {STATES.map((candidate) => <button key={candidate} type="button" data-active={state === candidate || undefined} onClick={() => { setState(candidate); setFailed(new Set()); }}>{STATE_LABELS[candidate]}</button>)}
        </section>
        <section>
          <b>办公室时段</b>
          {TIMES.map((candidate) => <button key={candidate} type="button" data-active={time === candidate || undefined} onClick={() => setTime(candidate)}>{OFFICE_SHADERS[candidate].label}</button>)}
        </section>
      </nav>
      <section className="opc-testFloor" style={{ ...shader.style, "--opc-office-background": `url("${shader.background}")` } as CSSProperties}>
        {characters.map((character) => {
          const key = `${character}:${state}`;
          return <article className="opc-testCard" key={key}>
            <header><strong>{character}</strong><small>{STATE_LABELS[state]}</small></header>
            {failed.has(key) ? <div className="opc-testError">未找到该状态动画</div> : <video key={key} className="opc-testVideo" src={animationUrl(character, state, manifest)} autoPlay loop muted playsInline onError={() => setFailed((current) => new Set(current).add(key))} />}
          </article>;
        })}
      </section>
    </main>
  );
}
