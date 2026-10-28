import { useMemo, useRef, useState } from "react";
import { X, Play, FastForward, Pause, Check, Volume2, VolumeX, SkipForward } from "lucide-react";
import * as E from "../lib/engine.js";
import { update } from "../lib/store.js";
import { soundOn, setSound, unlock } from "../lib/sound.js";
import { Badge, TEAM_COLORS, teamColor } from "../components/ui.jsx";
import { ConfettiLayer } from "../components/Confetti.jsx";
import Wheel from "../components/Wheel.jsx";
import { getApart, getTogether } from "../components/Together.jsx";

const POTS = ["Pot 1 · Man 1", "Pot 2 · Man 2", "Women"];

// The draw ceremony. The balanced teams are worked out first; the wheel then
// reveals them one pick at a time: all of Pot 1, then Pot 2, then the women.
export default function TeamDraw({ S, onClose }) {
  const plan = useMemo(() => {
    const cols = E.balancedTeams(S, undefined, getTogether(), getApart());
    const order = E.shuffle([...Array(E.NT).keys()]); // teams are called in random order in each pot
    const steps = [];
    cols.forEach((col, c) => order.forEach(t => steps.push({ c, t, f: E.SLOTS[c], p: col[t] })));
    return { cols, steps };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const total = plan.steps.length;
  const [k, setK] = useState(0);        // picks revealed so far
  const [wk, setWk] = useState(0);      // pick the wheel is showing (stays on the last result until the next spin)
  const [spinning, setSpinning] = useState(false);
  const [auto, setAutoState] = useState(false);
  const autoRef = useRef(false);
  const setAuto = v => { autoRef.current = v; setAutoState(v); };
  const [spinKey, setSpinKey] = useState(0);
  const [pop, setPop] = useState(null); // "t-f" of the slot just filled
  const [sound, setSnd] = useState(soundOn());

  const done = k >= total, step = plan.steps[Math.min(wk, total - 1)], up = plan.steps[Math.min(k, total - 1)];
  const left = plan.steps.filter((s, i) => s.c === step.c && i >= wk).map(s => s.p);
  const items = left.map((p, i) => ({ label: p.name, color: TEAM_COLORS[(i * 3 + step.c * 2) % TEAM_COLORS.length] }));
  const target = left.indexOf(step.p);
  const shown = plan.steps.slice(0, k);
  const name = (t, f) => { const s = shown.find(x => x.t === t && x.f === f); return s ? s.p.name : ""; };
  const last = k > wk ? plan.steps[k - 1] : null; // result card after a landing

  const go = () => { setWk(k); setSpinning(true); setSpinKey(x => x + 1); };
  const spin = () => { if (spinning || done) return; unlock(); setAuto(false); go(); };
  const startAuto = () => { if (done) return; unlock(); setAuto(true); if (!spinning) go(); };
  const landed = () => {
    setSpinning(false);
    setPop(step.t + "-" + step.f);
    const nk = wk + 1;
    setK(x => Math.max(x, nk)); // "Reveal all" during a spin wins
    if (autoRef.current && nk < total) setTimeout(() => { if (autoRef.current) { setWk(nk); setSpinning(true); setSpinKey(x => x + 1); } }, 1700);
  };
  const save = () => { update(n => E.SLOTS.forEach((f, c) => n.teams.forEach((x, t) => { x[f] = plan.cols[c][t].name; }))); onClose(true); };
  const skip = () => { setAuto(false); setSpinning(false); setK(total); setWk(total); };
  const toggleSound = () => { setSound(!sound); setSnd(!sound); };
  const pw = Array.from({ length: E.NT }, (_, t) => plan.cols.reduce((a, col) => a + col[t].lvl, 0));

  return (
    <div className="ceremony" role="dialog" aria-modal="true" aria-label="Team draw">
      <ConfettiLayer />
      <div className="cer-top">
        <button className="icon-btn" onClick={() => (k === 0 || done || confirm("Stop the draw? The teams will not change.")) && onClose(false)} aria-label="Close"><X size={18} /></button>
        <div className="cer-title"><b>Team draw</b><small>{done ? "All picks revealed" : `Pick ${Math.min(k + 1, total)} of ${total}`}</small></div>
        <button className="icon-btn" onClick={toggleSound} aria-label={sound ? "Mute" : "Sound on"}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        <div className="cer-bar"><span style={{ width: `${(k / total) * 100}%` }} /></div>
      </div>

      {!done ? (
        <>
          <div className="cer-stage">
            <div className="cer-pot">{POTS[up.c]}</div>
            <div className="cer-for">{spinning ? "Drawing for" : "Next up"} <Badge S={S} t={up.t} size="sm" /> <b>{E.tn(S, up.t)}</b></div>
          </div>
          <Wheel items={items} target={target} spinKey={spinKey} duration={auto ? 2600 : 4600} onDone={landed} onHub={spin} />
          <div className="cer-result" aria-live="polite">
            {last && !spinning ? (
              <div className="reveal" key={k} style={{ "--tc": teamColor(last.t) }}>
                <small>{POTS[last.c]}</small>
                <b>{last.p.name}</b>
                <div className="joins"><span>joins</span><Badge S={S} t={last.t} size="sm" /><span className="tname">{E.tn(S, last.t)}</span></div>
              </div>
            ) : <span className="cer-wait">{spinning ? "Here we go…" : "Tap SPIN in the middle of the wheel"}</span>}
          </div>
          <div className="btns cer-btns">
            <button className="btn primary" onClick={spin} disabled={spinning}><Play size={16} />Spin</button>
            {auto ? <button className="btn" onClick={() => setAuto(false)}><Pause size={16} />Pause</button>
              : <button className="btn" onClick={startAuto} disabled={spinning}><FastForward size={16} />Auto</button>}
            <button className="btn" onClick={skip}><SkipForward size={16} />Reveal all</button>
          </div>
        </>
      ) : (
        <div className="cer-done">
          <div className="brand-mark"><Check size={30} strokeWidth={3} /></div>
          <b>Teams are drawn</b>
          <span>Strength {Math.min(...pw)} to {Math.max(...pw)}. You can still swap players before locking.</span>
          <div className="btns"><button className="btn primary block" onClick={save}>Use these teams</button></div>
        </div>
      )}

      <div className="cer-teams">
        {S.teams.map((x, t) => (
          <div key={t} className={`cer-team ${up.t === t && !done ? "now" : ""}`} style={{ "--tc": teamColor(t) }}>
            <div className="cer-team-h"><Badge S={S} t={t} size="sm" /><span>{E.tn(S, t)}</span></div>
            {E.SLOTS.map(f => {
              const v = name(t, f);
              return <div key={f} className={`cer-slot ${v ? "" : "empty"} ${pop === t + "-" + f ? "pop" : ""}`}>{v || E.SLOT[f]}</div>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
