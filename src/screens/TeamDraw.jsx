import { useEffect, useMemo, useRef, useState } from "react";
import { X, Play, FastForward, Pause, Check, Volume2, VolumeX, SkipForward, Sparkles } from "lucide-react";
import * as E from "../lib/engine.js";
import { update } from "../lib/store.js";
import { soundOn, setSound, unlock, beep, whoosh, drumroll, fanfare } from "../lib/sound.js";
import { Badge, TEAM_COLORS, teamColor } from "../components/ui.jsx";
import { ConfettiLayer, confetti } from "../components/Confetti.jsx";
import Wheel from "../components/Wheel.jsx";
import { getApart, getTogether } from "../components/Together.jsx";

const POTS = ["Pot 1 · Man 1", "Pot 2 · Man 2", "Women"];

const AUTO_SPIN = 2600, MANUAL_SPIN = 4600, WIND = 320; // ms; the wheel winds back for WIND before spinning
const POT_NOTE = ["The stronger half of the men", "The rest of the men", "One woman for each team"];

// The draw ceremony. The balanced teams are worked out first; the wheel then
// reveals them one pick at a time: all of Pot 1, then Pot 2, then the women.
// The auto draw runs it as a show: a 3-2-1 countdown, a card for each pot, a drumroll
// while the wheel spins and a fanfare with confetti at the end.
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

  const [count, setCount] = useState(null); // 3, 2, 1, "Go!" before the auto draw
  const [intro, setIntro] = useState(null);  // pot shown on its intro card
  const timers = useRef([]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const lock = useRef(null);
  useEffect(() => () => { timers.current.forEach(clearTimeout); autoRef.current = false; if (lock.current) lock.current.release().catch(() => {}); }, []);

  const spinAt = (nk, ms) => { setWk(nk); setSpinning(true); setSpinKey(x => x + 1); if (autoRef.current) drumroll(ms + WIND); };
  // In the auto draw each pot opens with its own card.
  const autoAt = nk => {
    if (!autoRef.current) return;
    if (nk === 0 || plan.steps[nk - 1].c !== plan.steps[nk].c) {
      setWk(nk); setIntro(plan.steps[nk].c); whoosh();
      later(() => { setIntro(null); if (autoRef.current) spinAt(nk, AUTO_SPIN); }, 1900);
    } else spinAt(nk, AUTO_SPIN);
  };
  const spin = () => { if (spinning || done || count != null || intro != null) return; unlock(); setAuto(false); spinAt(k, MANUAL_SPIN); };
  const startAuto = () => {
    if (done || count != null) return;
    unlock(); setAuto(true);
    // Keep the screen on for the whole show.
    if (navigator.wakeLock && !lock.current) navigator.wakeLock.request("screen").then(l => { lock.current = l; }, () => {});
    if (spinning) return;
    if (k > 0) { autoAt(k); return; }
    [3, 2, 1, "Go!"].forEach((c, i) => later(() => { if (autoRef.current) { setCount(c); beep(c === "Go!"); } }, i * 800));
    later(() => { setCount(null); autoAt(0); }, 3 * 800 + 650);
  };
  const pause = () => { setAuto(false); setCount(null); };
  const landed = () => {
    setSpinning(false);
    setPop(step.t + "-" + step.f);
    const nk = wk + 1;
    setK(x => Math.max(x, nk)); // "Reveal all" during a spin wins
    if (autoRef.current && nk < total) later(() => autoAt(nk), 1500);
  };
  // The finale: fanfare and confetti across the screen.
  useEffect(() => {
    if (!done) return;
    fanfare();
    if (navigator.vibrate) navigator.vibrate([60, 60, 60, 60, 200]);
    [[0.5, 0.3, 0], [0.2, 0.45, 350], [0.8, 0.45, 650], [0.5, 0.2, 1000]].forEach(([x, y, t]) => later(() => confetti(innerWidth * x, innerHeight * y), t));
    if (lock.current) { lock.current.release().catch(() => {}); lock.current = null; }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => { update(n => E.SLOTS.forEach((f, c) => n.teams.forEach((x, t) => { x[f] = plan.cols[c][t].name; }))); onClose(true); };
  const skip = () => { setAuto(false); setCount(null); setIntro(null); setSpinning(false); setK(total); setWk(total); };
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
          <Wheel items={items} target={target} spinKey={spinKey} duration={auto ? AUTO_SPIN : MANUAL_SPIN} onDone={landed} onHub={auto ? undefined : spin} />
          <div className="cer-result" aria-live="polite">
            {last && !spinning ? (
              <div className="reveal" key={k} style={{ "--tc": teamColor(last.t) }}>
                <small>{POTS[last.c]}</small>
                <b>{last.p.name}</b>
                <div className="joins"><span>joins</span><Badge S={S} t={last.t} size="sm" /><span className="tname">{E.tn(S, last.t)}</span></div>
              </div>
            ) : <span className="cer-wait">{spinning ? (left.length === 1 ? "Last one in the pot…" : "Here we go…") : auto ? "Get ready…" : k === 0 ? "Start the auto draw, or spin one at a time" : "Tap SPIN in the middle of the wheel"}</span>}
          </div>
          <div className="btns cer-btns">
            {auto ? <button className="btn primary" onClick={pause}><Pause size={16} />Pause</button>
              : k === 0 ? <button className="btn primary cer-go" onClick={startAuto} disabled={spinning}><Sparkles size={16} />Start auto draw</button>
              : <button className="btn primary" onClick={startAuto} disabled={spinning}><FastForward size={16} />Continue auto</button>}
            {!auto && <button className="btn" onClick={spin} disabled={spinning}><Play size={16} />{k === 0 ? "Spin one" : "Spin"}</button>}
            <button className="btn" onClick={skip}><SkipForward size={16} />Reveal all</button>
          </div>
          {count != null && <div className="cer-count" aria-live="assertive"><b key={count}>{count}</b></div>}
          {intro != null && (
            <div className="cer-intro" aria-live="assertive">
              <div><small>Next up</small><b>{POTS[intro]}</b><span>{POT_NOTE[intro]}</span></div>
            </div>
          )}
        </>
      ) : (
        <div className="cer-done finale">
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
