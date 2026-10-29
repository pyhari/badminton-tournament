import { useEffect, useMemo, useRef, useState } from "react";
import { X, Play, FastForward, Pause, Check, Volume2, VolumeX, SkipForward, Sparkles } from "lucide-react";
import * as E from "../lib/engine.js";
import { funFact } from "../lib/funFacts.js";
import { update } from "../lib/store.js";
import { soundOn, setSound, unlock, beep, whoosh, drumroll, fanfare } from "../lib/sound.js";
import { Badge, TEAM_COLORS, teamColor } from "../components/ui.jsx";
import { ConfettiLayer, confetti } from "../components/Confetti.jsx";
import Wheel from "../components/Wheel.jsx";

// Shown to everyone watching the draw, so nothing here hints at player levels.
const POTS = ["Man 1", "Man 2", "Women"];

const AUTO_SPIN = 2600, MANUAL_SPIN = 4600, WIND = 320; // ms; the wheel winds back for WIND before spinning
const POT_NOTE = ["One man for each team", "A second man for each team", "One woman for each team"];

// The draw ceremony. The balanced teams are worked out first; the wheel then
// reveals them one pick at a time: all of Pot 1, then Pot 2, then the women.
// The auto draw runs it as a show: a 3-2-1 countdown, a card for each pot, a drumroll
// while the wheel spins and a fanfare with confetti at the end.
// How big a fun fact grows, and settles: long facts grow a little less, so the card stays a sensible size.
const factSize = f => ({ "--peak": Math.max(18, Math.min(23, 23 - (f.length - 80) / 12)) + "px", "--end": (f.length > 110 ? 15 : 16) + "px" });

export default function TeamDraw({ S, onClose }) {
  const plan = useMemo(() => {
    const cols = E.balancedTeams(S);
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
  const [peek, setPeek] = useState(false); // the reveal card was tapped away to see the wheel
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

  const spinAt = (nk, ms) => { setWk(nk); setPeek(false); setSpinning(true); setSpinKey(x => x + 1); if (autoRef.current) drumroll(ms + WIND); };
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
    // A fun fact under the name needs a moment to read before the next spin.
    const read = funFact(step.p.name) ? 4200 : 1500; // the fact grows, holds and settles (about 3s)
    if (autoRef.current && nk < total) later(() => autoAt(nk), read);
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

  return (
    <div className="ceremony" role="dialog" aria-modal="true" aria-label="Team draw">
      <ConfettiLayer />
      <div className="cer-top">
        <button className="icon-btn" onClick={() => (k === 0 || done || confirm("Stop the draw? The teams will not change.")) && onClose(false)} aria-label="Close"><X size={18} /></button>
        <div className="cer-title"><b>Team draw</b><small>{done ? "All picks revealed" : `Pick ${Math.min(k + 1, total)} of ${total}`}</small></div>
        {!done && <button className="btn cer-skip" onClick={skip}><SkipForward size={14} />Reveal all</button>}
        <button className="icon-btn" onClick={toggleSound} aria-label={sound ? "Mute" : "Sound on"}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        <div className="cer-bar"><span style={{ width: `${(k / total) * 100}%` }} /></div>
      </div>

      {!done ? (
        <>
          {/* One screen: the wheel takes the room that is left, and the reveal pops up over it,
              so the teams below stay in view. */}
          <div className="cer-show">
            <div className="cer-stage">
              <div className="cer-pot">{POTS[up.c]}</div>
              <div className="cer-for">{spinning ? "Drawing for" : "Next up"} <Badge S={S} t={up.t} size="sm" /> <b>{E.tn(S, up.t)}</b></div>
            </div>
            <div className="cer-arena">
              <Wheel items={items} target={target} spinKey={spinKey} duration={auto ? AUTO_SPIN : MANUAL_SPIN} onDone={landed} onHub={auto ? undefined : spin} />
            </div>
            <p className="cer-wait">{spinning ? (left.length === 1 ? "Last one in the pot…" : "Here we go…") : auto ? "Get ready…" : k === 0 ? "Start the auto draw, or spin one at a time" : "Tap SPIN in the middle of the wheel"}</p>
            {last && !spinning && !peek && (
              <div className="cer-result over" aria-live="polite" onClick={() => setPeek(true)}>
                <div className="reveal" key={k} style={{ "--tc": teamColor(last.t) }}>
                  <small>{POTS[last.c]}</small>
                  <b>{last.p.name}</b>
                  {funFact(last.p.name) && <p className="reveal-fact" style={factSize(funFact(last.p.name))}>{funFact(last.p.name)}</p>}
                  <div className="joins"><span>joins</span><Badge S={S} t={last.t} size="sm" /><span className="tname">{E.tn(S, last.t)}</span></div>
                </div>
              </div>
            )}
          </div>
          <div className="btns cer-btns">
            {auto ? <button className="btn primary" onClick={pause}><Pause size={16} />Pause</button>
              : k === 0 ? <button className="btn primary cer-go" onClick={startAuto} disabled={spinning}><Sparkles size={16} />Start auto draw</button>
              : <button className="btn primary" onClick={startAuto} disabled={spinning}><FastForward size={16} />Continue auto</button>}
            {!auto && <button className="btn" onClick={spin} disabled={spinning}><Play size={16} />{k === 0 ? "Spin one" : "Spin"}</button>}
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
          <span>You can still swap players before locking.</span>
          <div className="btns"><button className="btn primary block" onClick={save}>Use these teams</button></div>
        </div>
      )}

      <div className="cer-teams">
        {S.teams.map((x, t) => (
          <div key={t} className={`cer-team ${up.t === t && !done ? "now" : ""}`} style={{ "--tc": teamColor(t) }} title={E.tn(S, t)}>
            <Badge S={S} t={t} size="sm" />
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
