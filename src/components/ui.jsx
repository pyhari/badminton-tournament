import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { abbr, tn, tp, res, courtOf, onCourt } from "../lib/engine.js";

// One colour per team, bright enough for dark text in both themes.
export const TEAM_COLORS = ["#ff6b6b", "#ffb020", "#3ddc97", "#4cc9f0", "#b388ff", "#ff7eb6", "#c6f432", "#ff8a3d"];
export const teamColor = t => t == null ? "var(--surface-3)" : TEAM_COLORS[t % TEAM_COLORS.length];

export function Badge({ S, t, size = "" }) {
  return <span className={`badge ${size} ${t == null ? "tbd" : ""}`} style={{ background: teamColor(t) }}>{abbr(S, t)}</span>;
}

export function Empty({ icon: Icon, title, children }) {
  return <div className="empty">{Icon && <Icon size={40} strokeWidth={1.6} />}<b>{title}</b>{children}</div>;
}

// Match state for the card header: finished, on court, or not played yet.
export function matchState(S, m) {
  const r = res(S, m);
  if (r.done) return { cls: "ft", text: "Final" };
  if (onCourt(S, m)) return { cls: "live", text: "Live", dot: true };
  return { cls: "", text: m.a == null || m.b == null ? "" : "Not played" };
}

export function MatchCard({ S, m, onOpen, showStage = true }) {
  const r = res(S, m), ready = m.a != null && m.b != null, st = matchState(S, m);
  const side = (t, label, i) => {
    const won = r.done && r.winner === i, lost = r.done && r.winner !== i;
    return (
      <div className={`row-team ${won ? "win" : ""} ${lost ? "lose" : ""}`}>
        <Badge S={S} t={ready ? t : null} />
        <div className="nm"><b>{ready ? tn(S, t) : label}</b>{ready && <small>{tp(S, t)}</small>}</div>
        <div className="games">{r.gs.map((g, k) => <span key={k} className={g && g.w === i ? "w" : ""}>{g ? (i === 0 ? g.a : g.b) : "–"}</span>)}</div>
        <div className="tie">{r.played ? r.gw[i] : ""}</div>
      </div>
    );
  };
  const Tag = onOpen && ready ? "button" : "div";
  return (
    <Tag className="match" onClick={onOpen && ready ? () => onOpen(m) : undefined}>
      <div className="match-head">
        <span className="grow">{showStage ? m.stage + (m.label ? " · " + m.label : "") : m.label || m.stage}</span>
        <span className={`state ${st.cls}`}>{st.dot && <span className="dot live" />}{st.text}</span>
        {st.cls === "live" && courtOf(S, m) && <span className="court on">Court {courtOf(S, m)}</span>}
      </div>
      {side(m.a, m.la, 0)}
      {side(m.b, m.lb, 1)}
      {!ready && <div className="match-foot">Waiting for earlier results</div>}
      {ready && r.bad.length > 0 && <div className="match-foot warn"><AlertTriangle size={14} /> Check game {r.bad.map(i => i + 1).join(" and ")}: not a finished score</div>}
      {ready && onOpen && !r.played && <div className="match-foot">{courtOf(S, m) ? "Tap to enter scores" : "Tap to call to a court or enter scores"}</div>}
    </Tag>
  );
}

export function Sheet({ onClose, children }) {
  useEffect(() => {
    const k = e => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="grab" />
        {children}
      </div>
    </div>
  );
}

// toast("text") shows a short message at the top of the screen.
let showToast = () => {};
export const toast = msg => showToast(msg);
export function Toaster() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    let timer;
    showToast = m => { setMsg(m); clearTimeout(timer); timer = setTimeout(() => setMsg(null), 3200); };
    return () => clearTimeout(timer);
  }, []);
  return msg ? <div className="toast" role="status" onClick={() => setMsg(null)}>{msg}</div> : null;
}
