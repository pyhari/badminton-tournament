import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useRecap } from "../lib/insightsFeed.js";
import { matchTag, tieFacts } from "../lib/insights.js";
import { abbr, tn, res, courtOf, onCourt, roster, pairPlayers } from "../lib/engine.js";

// One colour per team, bright enough for dark text in both themes.
export const TEAM_COLORS = ["#ff6b6b", "#ffb020", "#3ddc97", "#4cc9f0", "#b388ff", "#ff7eb6", "#c6f432", "#ff8a3d"];
export const teamColor = t => t == null ? "var(--surface-3)" : TEAM_COLORS[t % TEAM_COLORS.length];

export function Badge({ S, t, size = "" }) {
  return <span className={`badge ${size} ${t == null ? "tbd" : ""}`} style={{ background: teamColor(t) }}>{abbr(S, t)}</span>;
}

// A short buzz under the finger on phones that support it (Android; iPhones ignore it).
export const buzz = (ms = 8) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

// Player names with a small dot for women and men (see GenderKey).
export function Names({ list }) {
  return <span className="names">{list.map((p, i) => <span key={i} className="pn"><i className={`gd ${p.g === "F" ? "f" : "m"}`} aria-label={p.g === "F" ? "woman" : "man"} />{p.name}</span>)}</span>;
}
export const Players = ({ S, t }) => <Names list={roster(S, t)} />;
export const Pair = ({ S, t, i }) => <Names list={pairPlayers(S, t, i)} />;
// A team's name with its players underneath, the same way everywhere: the men on one line,
// the woman on the next.
export function TeamName({ S, t, className = "" }) {
  const list = roster(S, t), men = list.filter(p => p.g !== "F"), women = list.filter(p => p.g === "F");
  return <span className={`tm-nm ${className}`}><b>{tn(S, t)}</b><small>{men.length > 0 && <Names list={men} />}{women.length > 0 && <Names list={women} />}</small></span>;
}
export const GenderKey = () => <span className="gkey"><span><i className="gd f" />Women</span><span><i className="gd m" />Men</span></span>;

export function Empty({ icon: Icon, title, children }) {
  return <div className="empty">{Icon && <Icon size={40} strokeWidth={1.6} />}<b>{title}</b>{children}</div>;
}

// The last value shown under each key. Kept outside the components, because a tie's
// card moves between sections (to "On court now" and back) as its scores change.
const seen = new Map();
// 0 if the value has not changed lately; otherwise a count that goes up with each change.
function changed(key, v) {
  const e = seen.get(key);
  if (!e) { seen.set(key, { v, n: 0, at: 0 }); return 0; } // first time shown: no effect
  if (e.v !== v) { e.v = v; e.n++; e.at = Date.now(); }
  return Date.now() - e.at < 1500 ? e.n : 0;
}
// A number that pops when it changes, so new scores catch the eye.
export function Pop({ id, v, className = "" }) {
  const n = changed(id, v);
  return <span key={n} className={`${className} ${n ? "pop" : ""}`}>{v}</span>;
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
  // The card glows briefly when any score in it changes (two class names, so the glow restarts each time).
  const bumps = changed(m.id, r.gs.map(g => g ? g.a + "-" + g.b : "").join() + ready);
  const recap = useRecap(m.id);
  const side = (t, label, i) => {
    const won = r.done && r.winner === i, lost = r.done && r.winner !== i;
    return (
      <div className={`row-team ${won ? "win" : ""} ${lost ? "lose" : ""}`}>
        <Badge S={S} t={ready ? t : null} />
        {ready ? <TeamName S={S} t={t} className="nm" /> : <div className="nm"><b>{label}</b></div>}
        <div className="games">{r.gs.map((g, k) => <Pop key={k} id={`${m.id}.${i}.${k}`} className={g && g.w === i ? "w" : ""} v={g ? (i === 0 ? g.a : g.b) : "–"} />)}</div>
        <div className="tie"><Pop id={`${m.id}.${i}`} v={r.played ? r.gw[i] : ""} /></div>
      </div>
    );
  };
  const Tag = onOpen && ready ? "button" : "div";
  return (
    <Tag key={bumps} className={`match ${bumps ? "glow" : ""}`} onClick={onOpen && ready ? () => onOpen(m) : undefined}>
      <div className="match-head">
        <span className="grow">{showStage ? m.stage + (m.label ? " · " + m.label : "") : m.label || m.stage}</span>
        <span className={`state ${st.cls}`}>{st.dot && <span className="dot live" />}{st.text}</span>
        {st.cls === "live" && courtOf(S, m) && <span className="court on">Court {courtOf(S, m)}</span>}
      </div>
      {side(m.a, m.la, 0)}
      {side(m.b, m.lb, 1)}
      {!ready && <div className="match-foot">Waiting for earlier results</div>}
      {ready && r.bad.length > 0 && <div className="match-foot warn"><AlertTriangle size={14} /> Check game {r.bad.map(i => i + 1).join(" and ")}: not a finished score</div>}
      {r.done && recap && <div className="recap"><Sparkles size={13} /><span>{matchTag(tieFacts(S, m)) && <b className="recap-tag">{matchTag(tieFacts(S, m))}</b>}{recap}</span></div>}
      {ready && onOpen && !r.played && <div className="match-foot">{courtOf(S, m) ? "Tap to enter scores" : "Tap to call to a court or enter scores"}</div>}
    </Tag>
  );
}

export function Sheet({ onClose, children }) {
  const sheet = useRef(null), scrim = useRef(null);
  useEffect(() => {
    const k = e => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [onClose]);

  // Drag down to close, like a phone's own sheets: from the top of the sheet's
  // scroll only, so scrolling up through the games still works.
  useEffect(() => {
    const el = sheet.current, bg = scrim.current;
    let y0 = null, t0 = 0, dy = 0, dragging = false;
    const move = to => { el.style.transform = to ? `translateY(${to}px)` : ""; bg.style.backgroundColor = `rgba(0, 0, 0, ${0.55 * Math.max(0, 1 - to / el.offsetHeight)})`; };
    const start = e => { if (el.scrollTop > 0 || e.touches.length > 1) { y0 = null; return; } y0 = e.touches[0].clientY; t0 = e.timeStamp; dy = 0; dragging = false; };
    const drag = e => {
      if (y0 == null) return;
      dy = e.touches[0].clientY - y0;
      if (!dragging && dy > 8 && el.scrollTop <= 0) { dragging = true; el.style.transition = "none"; }
      if (!dragging) return;
      e.preventDefault();
      move(Math.max(0, dy - 8));
    };
    const end = e => {
      if (!dragging) { y0 = null; return; }
      const fast = dy / Math.max(1, e.timeStamp - t0) > 0.4; // px per ms: a flick
      el.style.transition = "transform .22s cubic-bezier(.2, .9, .3, 1)";
      if (dy > Math.min(140, el.offsetHeight / 3) || (fast && dy > 30)) { move(el.offsetHeight); setTimeout(onClose, 180); }
      else move(0);
      y0 = null; dragging = false;
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", drag, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", drag); el.removeEventListener("touchend", end); el.removeEventListener("touchcancel", end); };
  }, [onClose]);

  return (
    <div className="scrim" ref={scrim} onClick={onClose}>
      <div className="sheet" ref={sheet} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
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
