import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { CharacterManifest, SessionState } from "../protocol.ts";
import { animationUrl } from "./OfficePanel.tsx";
import {
  OFFICE_SEAT_ORDER,
  OFFICE_SHADERS,
  type OfficeTime,
} from "./office-shaders.ts";

const STATES: readonly SessionState[] = [
  "idle",
  "thinking",
  "reading",
  "writing",
  "await",
  "error",
];
const STATE_LABELS: Record<SessionState, string> = {
  idle: "待命",
  thinking: "思考",
  reading: "阅读",
  writing: "编写",
  await: "等待授权",
  error: "错误",
};
const TIMES: readonly OfficeTime[] = [
  "morning",
  "noon",
  "afternoon",
  "evening",
  "night",
];
const TEST_CSS = `.opc-test{position:fixed;z-index:999;inset:0;display:grid;place-items:center;overflow:hidden;padding:14px;color:#fff1c7;background:#10131b;font-family:"Microsoft YaHei",ui-rounded,system-ui,sans-serif}.opc-test *{box-sizing:border-box}.opc-testHead{position:fixed;z-index:20;top:18px;left:26px;max-width:min(520px,calc(100vw - 52px));padding:11px 15px;border:2px solid #88633b;background:#171928df;box-shadow:3px 3px #08090e;pointer-events:none}.opc-testHead h1,.opc-testHead p{margin:0}.opc-testHead h1{font-size:20px;letter-spacing:.12em}.opc-testHead p{margin-top:4px;color:#aec8d5;font-size:11px}.opc-testControls{position:fixed;z-index:21;top:18px;right:26px;display:grid;gap:7px;max-width:min(760px,calc(100vw - 580px));padding:9px 11px;border:2px solid #5d6c7e;background:#131b27e8;box-shadow:3px 3px #08090e}.opc-testControls section{display:flex;flex-wrap:wrap;align-items:center;gap:5px}.opc-testControls b{min-width:58px;color:#e5b95f;font-size:11px}.opc-testControls button{border:2px solid #596a7c;background:#202a38;color:#dbe9f4;padding:5px 8px;cursor:pointer;font:700 11px inherit}.opc-testControls button[data-active=true]{border-color:#ffd36b;background:#78502d;color:#fff3cb;box-shadow:2px 2px #08090e}.opc-testFloor{position:relative;isolation:isolate;width:min(calc(100vw - 28px),calc((100vh - 28px)*1.777777));aspect-ratio:16/9;border:4px solid #6a4f35;background-image:var(--opc-office-background);background-position:center;background-size:cover;background-repeat:no-repeat;box-shadow:0 0 0 2px #17111a,0 14px 40px #000a}.opc-testFloor:after{content:"";position:absolute;z-index:10;inset:0;pointer-events:none;background:var(--opc-atmosphere);opacity:var(--opc-opacity);mix-blend-mode:var(--opc-blend)}.opc-testSeat{position:absolute;z-index:2;left:var(--opc-seat-x);top:var(--opc-seat-y);width:28%;aspect-ratio:1;transform:translate(-50%,-90%) scale(var(--opc-seat-scale));transform-origin:center bottom}.opc-testSeat[data-row="1"]{z-index:3}.opc-testSeat[data-row="2"]{z-index:4}.opc-testSeat[data-row="3"]{z-index:5}.opc-testVideo{display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated;filter:var(--opc-character-filter) drop-shadow(2px 3px 0 #071018aa)}.opc-testLabel{position:absolute;z-index:2;bottom:5%;left:8%;width:84%;padding:2px 4px;border:1px solid #8aa9b7;background:#111b25df;color:#e8f2ff;text-align:center;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.opc-testEmpty{position:absolute;inset:36% 30% 28%;border:1px dashed #b9c9d844;background:#0b132255}.opc-testError{position:absolute;inset:33% 16% 25%;display:grid;place-items:center;border:2px solid #cb6a67;background:#38212ad9;color:#ffb6a8;text-align:center;font-size:11px}@media(max-width:980px){.opc-testHead{top:12px;left:12px}.opc-testControls{top:auto;right:12px;bottom:12px;max-width:calc(100vw - 24px)}.opc-testFloor{width:calc(100vw - 20px)}}`;

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
  // Test pages must always reflect replace-in-place development assets. Keep
  // one stable revision for this page load so videos do not restart on render.
  const [assetRevision] = useState(() => Date.now().toString(36));

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

  const discoveredCharacters = Object.keys(manifest?.characters ?? {});
  const configuredCharacters =
    manifest === undefined
      ? []
      : [
          manifest.fallbackCharacter,
          ...Object.values(manifest.modelCharacters),
        ];
  const characters =
    discoveredCharacters.length > 0
      ? discoveredCharacters
      : [...new Set(configuredCharacters)];
  const shader = OFFICE_SHADERS[time];
  return (
    <main className="opc-test">
      <header className="opc-testHead">
        <h1>动画渲染试验场</h1>
        <p>
          仅可通过地址访问，不会出现在导航中。切换状态和时段以检查 WebM
          透明叠放效果。
        </p>
      </header>
      <nav className="opc-testControls" aria-label="动画预览控制">
        <section>
          <b>角色状态</b>
          {STATES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              data-active={state === candidate || undefined}
              onClick={() => {
                setState(candidate);
                setFailed(new Set());
              }}
            >
              {STATE_LABELS[candidate]}
            </button>
          ))}
        </section>
        <section>
          <b>办公室时段</b>
          {TIMES.map((candidate) => (
            <button
              key={candidate}
              type="button"
              data-active={time === candidate || undefined}
              onClick={() => setTime(candidate)}
            >
              {OFFICE_SHADERS[candidate].label}
            </button>
          ))}
        </section>
      </nav>
      <section
        className="opc-testFloor"
        style={
          {
            ...shader.style,
            "--opc-office-background": `url("${shader.background}?revision=${assetRevision}")`,
          } as CSSProperties
        }
      >
        {OFFICE_SEAT_ORDER.map((seat, index) => {
          const character = characters[index];
          const anchor = shader.seats[seat.anchor];
          if (anchor === undefined) return null;
          const key = `${character ?? "empty"}:${state}:${seat.row}:${seat.anchor}`;
          return (
            <article
              className="opc-testSeat"
              data-row={seat.row}
              key={key}
              style={
                {
                  "--opc-seat-x": `${anchor.x}%`,
                  "--opc-seat-y": `${anchor.y}%`,
                  "--opc-seat-scale": anchor.scale,
                } as CSSProperties
              }
            >
              {character === undefined ? (
                <div className="opc-testEmpty" aria-label="空工位" />
              ) : failed.has(key) ? (
                <div className="opc-testError">未找到该状态动画</div>
              ) : (
                <>
                  <video
                    key={key}
                    className="opc-testVideo"
                    src={animationUrl(
                      character,
                      state,
                      manifest,
                      assetRevision,
                    )}
                    autoPlay
                    loop
                    muted
                    playsInline
                    onError={() =>
                      setFailed((current) => new Set(current).add(key))
                    }
                  />
                  <small className="opc-testLabel">
                    {character} · {STATE_LABELS[state]}
                  </small>
                </>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
