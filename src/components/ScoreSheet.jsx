import { Minus, Plus, X } from "lucide-react";
import { GAME_LABELS, allMatches, busyCourts, courtCount, courtOf, pairOf, res, scoresOf, setCourt, setScore, tn, validGame } from "../lib/engine.js";
import { update } from "../lib/store.js";
import { Badge, Sheet, buzz, Pair } from "./ui.jsx";

export default function ScoreSheet({ S, id, onClose }) {
  const m = allMatches(S).find(x => x.id === id);
  if (!m || m.a == null || m.b == null) return null;
  const r = res(S, m), sc = scoresOf(S, m);
  const val = (g, s) => (sc[g] && sc[g][s] !== undefined ? sc[g][s] : "");
  const put = (g, s, v) => update(n => {
    const mm = allMatches(n).find(x => x.id === id);
    setScore(n, mm, g, s, v === "" ? "" : Math.max(0, Math.min(40, Math.round(+v || 0))));
  });
  const step = (g, s, d) => { buzz(); put(g, s, Math.max(0, (+val(g, s) || 0) + d)); };

  const stepper = (g, s) => {
    const won = r.gs[g] && r.gs[g].w === s;
    return (
      <div className="stepper">
        <button aria-label="Minus one" onClick={() => step(g, s, -1)}><Minus size={16} /></button>
        <input className={won ? "won" : ""} type="number" inputMode="numeric" min="0" max="40" value={val(g, s)}
          aria-label={`Game ${g + 1}, ${tn(S, s ? m.b : m.a)}`}
          onFocus={e => e.target.select()} onChange={e => put(g, s, e.target.value)} />
        <button aria-label="Plus one" onClick={() => step(g, s, 1)}><Plus size={16} /></button>
      </div>
    );
  };

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-head">
        <h3>{m.stage}{m.label ? " · " + m.label : ""}</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <div className="vs-head">
        <div className="side"><Badge S={S} t={m.a} size="lg" /><span>{tn(S, m.a)}</span></div>
        <div className="big num">{r.gw[0]}<span style={{ color: "var(--muted)" }}> : </span>{r.gw[1]}</div>
        <div className="side"><Badge S={S} t={m.b} size="lg" /><span>{tn(S, m.b)}</span></div>
      </div>
      {!r.done && <CourtPicker S={S} m={m} />}
      {GAME_LABELS.map((label, g) => {
        const gm = r.gs[g];
        return (
          <div className="game-edit" key={g}>
            <div className="gl"><span>Game {g + 1} · {label}</span>{gm && !validGame(gm) && <span className="warn">Not a finished score</span>}</div>
            <div className="ge-row">
              <div className="ge-side"><small><Pair S={S} t={m.a} i={g} /></small>{stepper(g, 0)}</div>
              <span className="ge-colon">:</span>
              <div className="ge-side r"><small><Pair S={S} t={m.b} i={g} /></small>{stepper(g, 1)}</div>
            </div>
          </div>
        );
      })}
      <p className="hint">Games go to 15 with no cap: 15–13 or better, or two clear after 14–all. Scores save as you type.</p>
      <button className="btn primary block" onClick={onClose}>{r.done ? `${tn(S, r.winner ? m.b : m.a)} win ${Math.max(...r.gw)}–${Math.min(...r.gw)}` : "Done"}</button>
    </Sheet>
  );
}

// Call the tie to a free court. Busy courts show which tie is on them.
function CourtPicker({ S, m }) {
  const busy = busyCourts(S), mine = courtOf(S, m);
  const pick = c => update(n => setCourt(n, m.id, c === mine ? null : c));
  return (
    <div className="courts">
      <span className="lbl" style={{ margin: 0 }}>Court</span>
      {Array.from({ length: courtCount(S) }, (_, i) => i + 1).map(c => {
        const other = busy[c] && busy[c].id !== m.id ? busy[c] : null;
        return (
          <button key={c} className={`cpick ${mine === c ? "on" : ""} ${other ? "busy" : ""}`} onClick={() => pick(c)} disabled={!!other}
            aria-pressed={mine === c} title={other ? `In use: ${tn(S, other.a)} v ${tn(S, other.b)}` : `Court ${c}`}>
            {c}{other && <small>busy</small>}
          </button>
        );
      })}
    </div>
  );
}
