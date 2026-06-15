import { LIFECYCLE, STEP_LABEL } from "../lib/constants";

export function Timeline({ status }) {
  const sIdx = LIFECYCLE.indexOf(status);
  return (
    <div className="mt-1">
      {LIFECYCLE.map((s, i) => {
        const cls = i < sIdx ? "done" : i === sIdx ? "active" : "";
        return (
          <div key={s} className={`tl-step ${cls}`}>
            <div className="tl-dot">{i < sIdx ? "✓" : i === sIdx ? "●" : ""}</div>
            <div className="tl-body">
              <b>{STEP_LABEL[s][0]}</b>
              <small>{STEP_LABEL[s][1]}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 bottom-[150px] z-[60] px-4 py-3 rounded-xl text-[13px] font-bold max-w-[88%] text-paper"
      style={{ background: "var(--ink)", boxShadow: "0 8px 24px rgba(0,0,0,.3)" }}
    >
      {msg}
    </div>
  );
}

export function Empty({ emo, title, sub }) {
  return (
    <div className="text-center px-6 py-14" style={{ color: "var(--muted)" }}>
      <span className="block text-[42px] mb-3 opacity-60">{emo}</span>
      <b className="block text-[16px] text-ink font-extrabold mb-1">{title}</b>
      <small className="text-[13px] font-medium">{sub}</small>
    </div>
  );
}
