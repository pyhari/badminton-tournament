import { useEffect, useRef, useState } from "react";
import { X, Play, FastForward, Pause, Check, Volume2, VolumeX, SkipForward, Sparkles, Dices } from "lucide-react";
import * as E from "../lib/engine.js";
import { update, getState } from "../lib/store.js";
import { soundOn, setSound, unlock, beep, whoosh, drumroll, fanfare, tick, chime } from "../lib/sound.js";
import { Badge, TeamName, teamColor } from "../components/ui.jsx";
import { ConfettiLayer, confetti } from "../components/Confetti.jsx";

const ROLL = 2600; // ms the reel turns before the first team of a pot is revealed

// The group draw as a show. Each pot sends one team to each group: the reel picks the
// team for Group A, and the other team in the pot goes to Group B. Each pick is saved
// as soon as it is made; the screen reveals it at the end of the reel.
export default function GroupDraw({ S, onClose }) {
  const total = E.NT;
  const [shown, setShown] = useState(S.picks.length); // picks revealed on this screen
  const [reel, setReel] = useState(null);             // team on the reel
  const [rolling, setRolling] = useState(false);
  const [auto, setAutoState] = useState(false);
  const autoRef = useRef(false);
  const setAuto = v => { autoRef.current = v; setAutoState(v); };
  const [count, setCount] = useState(null);
  const [intro, setIntro] = useState(null);
  const [sound, setSnd] = useState(soundOn());
  const timers = useRef([]), lock = useRef(null);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => { timers.current.forEach(clearTimeout); autoRef.current = false; if (lock.current) lock.current.release().catch(() => {}); }, []);

  const done = shown >= total;
  const picks = S.picks.slice(0, shown);
  const pot = Math.min(Math.floor(shown / E.NG), total / E.NG - 1);
  const last = shown > 0 && !rolling ? { t: S.picks[shown - 1], ...E.seatOf(shown - 1) } : null;

  // Makes and saves pick k, then turns the reel and reveals it.
  const roll = k => {
    let t = getState().picks[k];
    if (t == null) update(n => { t = E.pickNext(n); });
    const pool = getState().pots[Math.floor(k / E.NG)];
    const first = k % E.NG === 0;
    setRolling(true);
    if (first) {
      const frames = [];
      for (let at = 0, d = 55; at < ROLL; at += d, d *= 1.09) frames.push(at);
      drumroll(frames[frames.length - 1]);
      // The reel flicks between the pot's teams and stops on the one drawn.
      const other = pool.find(x => x !== t) ?? t;
      frames.forEach((ms, i) => later(() => { setReel((frames.length - 1 - i) % 2 ? other : t); tick(); }, ms));
      later(() => reveal(k), frames[frames.length - 1] + 250);
    } else {
      // The last team in the pot has only one place to go.
      whoosh(); setReel(t);
      later(() => reveal(k), 900);
    }
  };
  const reveal = k => {
    setRolling(false); setShown(k + 1); chime();
    if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
    confetti(innerWidth / 2, innerHeight * 0.32);
    if (autoRef.current && k + 1 < total) later(() => autoAt(k + 1), 1700);
  };
  const autoAt = k => {
    if (!autoRef.current) return;
    if (k % E.NG === 0) {
      setReel(null); setIntro(Math.floor(k / E.NG)); whoosh();
      later(() => { setIntro(null); if (autoRef.current) roll(k); }, 1900);
    } else roll(k);
  };
  // The pots are made when the draw starts, so the pot cards can show their teams.
  const makePots = () => { if (!getState().pots.length) update(n => { n.pots = E.makePots(n); }); };
  const startAuto = () => {
    if (done || count != null) return;
    unlock(); makePots(); setAuto(true);
    if (navigator.wakeLock && !lock.current) navigator.wakeLock.request("screen").then(l => { lock.current = l; }, () => {});
    if (rolling) return;
    if (shown > 0) { autoAt(shown); return; }
    [3, 2, 1, "Go!"].forEach((c, i) => later(() => { if (autoRef.current) { setCount(c); beep(c === "Go!"); } }, i * 800));
    later(() => { setCount(null); autoAt(0); }, 3 * 800 + 650);
  };
  const one = () => { if (rolling || done || count != null || intro != null) return; unlock(); makePots(); setAuto(false); roll(shown); };
  const skip = () => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setAuto(false); setCount(null); setIntro(null); setRolling(false);
    update(n => { while (n.picks.length < total) E.pickNext(n); });
    setShown(total);
  };
  useEffect(() => {
    if (!done) return;
    fanfare();
    if (navigator.vibrate) navigator.vibrate([60, 60, 60, 60, 200]);
    [[0.5, 0.3, 0], [0.2, 0.45, 350], [0.8, 0.45, 650], [0.5, 0.2, 1000]].forEach(([x, y, t]) => later(() => confetti(innerWidth * x, innerHeight * y), t));
    if (lock.current) { lock.current.release().catch(() => {}); lock.current = null; }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleSound = () => { setSound(!sound); setSnd(!sound); };
  const close = () => (shown === 0 || done || confirm("Leave the group draw? The teams drawn so far stay in their groups.")) && onClose();

  return (
    <div className="ceremony" role="dialog" aria-modal="true" aria-label="Group draw">
      <ConfettiLayer />
      <div className="cer-top">
        <button className="icon-btn" onClick={close} aria-label="Close"><X size={18} /></button>
        <div className="cer-title"><b>Group draw</b><small>{done ? "All teams drawn" : `Pick ${shown + 1} of ${total}`}</small></div>
        {!done && <button className="btn cer-skip" onClick={skip}><SkipForward size={14} />Reveal all</button>}
        <button className="icon-btn" onClick={toggleSound} aria-label={sound ? "Mute" : "Sound on"}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
        <div className="cer-bar"><span style={{ width: `${(shown / total) * 100}%` }} /></div>
      </div>

      {!done ? (
        <>
          {/* One screen: the reel takes the room that is left, so both groups stay in view. */}
          <div className="cer-show gd-show">
            <div className="cer-stage">
              <div className="cer-pot">Pot {pot + 1}</div>
              <div className="gd-pot">{(S.pots[pot] || []).map(t => <span key={t} className={picks.includes(t) ? "gone" : ""}><Badge S={S} t={t} /></span>)}{!S.pots.length && <small>Two teams in each pot</small>}</div>
            </div>
            <div className={`gd-reel ${rolling ? "rolling" : ""} ${last && !rolling && reel != null ? "landed" : ""}`} style={{ "--tc": reel != null ? teamColor(reel) : "var(--surface-3)" }}>
              {reel != null ? <><Badge S={S} t={reel} size="lg" /><b>{E.tn(S, reel)}</b></> : <Dices size={54} strokeWidth={1.5} />}
            </div>
            <div className="cer-result" aria-live="polite">
              {last && reel === last.t ? (
                <div className="gd-to" key={shown}><span>goes to</span><b>Group {last.g}</b></div>
              ) : <span className="cer-wait">{rolling ? (shown % E.NG ? "…and the other team goes to Group B" : "Who goes to Group A?") : auto ? "Get ready…" : shown === 0 ? "Start the group draw, or draw one team at a time" : "Draw the next team"}</span>}
            </div>
          </div>
          <div className="btns cer-btns">
            {auto ? <button className="btn primary" onClick={() => { setAuto(false); setCount(null); }}><Pause size={16} />Pause</button>
              : shown === 0 ? <button className="btn primary cer-go" onClick={startAuto} disabled={rolling}><Sparkles size={16} />Start group draw</button>
              : <button className="btn primary" onClick={startAuto} disabled={rolling}><FastForward size={16} />Continue auto</button>}
            {!auto && <button className="btn" onClick={one} disabled={rolling}><Play size={16} />Draw one</button>}
          </div>
          {count != null && <div className="cer-count" aria-live="assertive"><b key={count}>{count}</b></div>}
          {intro != null && (
            <div className="cer-intro" aria-live="assertive">
              <div><small>Next up</small><b>Pot {intro + 1}</b><span className="gd-intro-teams">{(S.pots[intro] || []).map(t => <Badge key={t} S={S} t={t} />)}</span><span>One to Group A, one to Group B</span></div>
            </div>
          )}
        </>
      ) : (
        <div className="cer-done finale">
          <div className="brand-mark"><Check size={30} strokeWidth={3} /></div>
          <b>Groups are drawn</b>
          <span>The fixtures are ready in Matches.</span>
          <div className="btns"><button className="btn primary block" onClick={onClose}>Done</button></div>
        </div>
      )}

      <div className="groups2 gd-groups">
        {[0, 1].map(g => (
          <div className="glist" key={g}>
            <h4>Group {"AB"[g]}</h4>
            {Array.from({ length: total / E.NG }, (_, s) => {
              const k = s * E.NG + g, t = picks[k];
              return t != null
                ? <div className={`gitem ${k === shown - 1 ? "just" : ""}`} key={s} style={{ "--tc": teamColor(t) }}><span className="seat">{s + 1}</span><Badge S={S} t={t} size="sm" /><TeamName S={S} t={t} /></div>
                : <div className="gitem ph" key={s}><span className="seat">{s + 1}</span>Pot {s + 1}</div>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
