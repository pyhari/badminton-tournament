import { useEffect, useRef, useState } from "react";
import { tick, chime } from "../lib/sound.js";
import { confetti } from "./Confetti.jsx";

const BULBS = 24, R = 100;
const pt = (a, r) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)];
const ease = t => 1 - Math.pow(1 - t, 4);
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16), c = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

// A game-show wheel. Changing spinKey spins it so that items[target] stops under the pointer.
// The rotation runs in requestAnimationFrame so the pointer can flick on every peg.
export default function Wheel({ items, target, spinKey, duration = 4200, onDone, onHub, hubLabel = "SPIN" }) {
  const rotor = useRef(null), pointer = useRef(null), wrap = useRef(null);
  const angle = useRef(0), raf = useRef(0);
  const done = useRef(onDone); done.current = onDone;
  const [phase, setPhase] = useState("idle"); // idle | spinning | won
  const [won, setWon] = useState(null);
  const n = items.length, seg = 360 / n;

  const apply = a => { angle.current = a; if (rotor.current) rotor.current.setAttribute("transform", `rotate(${a})`); };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useEffect(() => {
    if (!spinKey) return;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const centre = (target + 0.5) * seg + (Math.random() - 0.5) * seg * 0.55;
    const a0 = angle.current, back = reduce ? 0 : 14, wind = reduce ? 0 : 320;
    const turns = reduce ? 0 : Math.max(3, Math.round(duration / 750));
    const from = a0 - back, base = from + 360 * turns;
    const to = base + ((((-centre - base) % 360) + 360) % 360);
    const len = reduce ? 1 : duration;
    let peg = Math.floor(((-a0 % 360) + 360) % 360 / seg), t0 = performance.now();
    setWon(null); setPhase("spinning");
    const step = now => {
      const t = now - t0;
      const a = t < wind ? a0 - back * Math.sin((t / wind) * Math.PI / 2) : from + (to - from) * ease(Math.min(1, (t - wind) / len));
      apply(a);
      const p = Math.floor(((-a % 360) + 360) % 360 / seg);
      if (p !== peg) {
        peg = p; tick();
        if (pointer.current && pointer.current.animate) pointer.current.animate([{ transform: "rotate(-22deg)" }, { transform: "rotate(0deg)" }], { duration: 140, easing: "ease-out" });
      }
      if (t < wind + len) { raf.current = requestAnimationFrame(step); return; }
      setWon(target); setPhase("won"); chime();
      if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
      const b = wrap.current && wrap.current.getBoundingClientRect();
      if (b) confetti(b.left + b.width / 2, b.top + b.height * 0.25);
      setTimeout(() => done.current && done.current(), 350);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
  }, [spinKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new set of slices (next pick) clears the highlight.
  const sig = items.map(i => i.label).join("|");
  useEffect(() => { if (phase === "won") { setPhase("idle"); setWon(null); } }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  const fs = n <= 3 ? 15 : n <= 5 ? 13 : n <= 8 ? 11 : 9.5;
  return (
    <div ref={wrap} className={`wheel ${phase}`}>
      <svg ref={pointer} className="wheel-pointer" viewBox="0 0 40 52" aria-hidden="true">
        <path d="M20 50 L5 16 A16 16 0 1 1 35 16 Z" fill="var(--text)" stroke="rgba(0,0,0,.35)" strokeWidth="1.5" />
        <circle cx="20" cy="16" r="6" fill="#d4ff3a" stroke="rgba(0,0,0,.35)" strokeWidth="1" />
      </svg>
      <svg viewBox="-124 -124 248 248" role="img" aria-label={won != null ? `Landed on ${items[won] && items[won].label}` : "Draw wheel"}>
        <defs>
          <radialGradient id="wh-rim" cx="50%" cy="35%" r="70%"><stop offset="0" stopColor="#3a4150" /><stop offset=".7" stopColor="#151922" /><stop offset="1" stopColor="#07090c" /></radialGradient>
          <radialGradient id="wh-shade" cx="50%" cy="50%" r="50%"><stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".38" /></radialGradient>
          <linearGradient id="wh-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".38" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
          <radialGradient id="wh-hub" cx="40%" cy="35%" r="75%"><stop offset="0" stopColor="#ffffff" /><stop offset=".25" stopColor="#d4ff3a" /><stop offset="1" stopColor="#5f7a00" /></radialGradient>
          <filter id="wh-glow" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="2.2" /></filter>
          {items.map((it, i) => (
            <linearGradient key={i} id={`wh-s${i}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" {...(() => { const [x, y] = pt((i + 0.5) * seg, R); return { x2: x, y2: y }; })()}>
              <stop offset="0" stopColor={shade(it.color, 0.78)} /><stop offset=".55" stopColor={it.color} /><stop offset="1" stopColor={shade(it.color, 1.12)} />
            </linearGradient>
          ))}
        </defs>

        <circle r="122" fill="url(#wh-rim)" />
        <circle r="122" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
        <g className="bulbs">
          {Array.from({ length: BULBS }, (_, i) => {
            const [x, y] = pt(i * 360 / BULBS, 111);
            return <g key={i} className={`bulb ${i % 2 ? "odd" : "even"}`}><circle cx={x} cy={y} r="5.5" className="halo" filter="url(#wh-glow)" /><circle cx={x} cy={y} r="3.4" className="core" /></g>;
          })}
        </g>
        <circle r={R + 2.5} fill="#07090c" />

        <g ref={rotor}>
          {items.map((it, i) => {
            const a0 = i * seg, a1 = a0 + seg, [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), mid = a0 + seg / 2;
            const dim = won != null && won !== i;
            return (
              <g key={i} className={`slice ${won === i ? "win" : ""}`} opacity={dim ? 0.28 : 1}>
                {n === 1 ? <circle r={R} fill={`url(#wh-s${i})`} />
                  : <path d={`M0,0 L${x0},${y0} A${R},${R} 0 ${seg > 180 ? 1 : 0} 1 ${x1},${y1} Z`} fill={`url(#wh-s${i})`} />}
                <text transform={`rotate(${mid - 90}) translate(${R - 10} 0)`} textAnchor="end" dominantBaseline="central"
                  fontSize={Math.min(fs, 52 / (Math.min(it.label.length, 12) * 0.84))} fontWeight="900" fill="#0a0c10" letterSpacing=".4" style={{ fontFamily: "Inter, system-ui, sans-serif", textTransform: "uppercase" }}>
                  {it.label.length > 12 ? it.label.slice(0, 11) + "…" : it.label}
                </text>
              </g>
            );
          })}
          {n > 1 && items.map((_, i) => { const [x, y] = pt(i * seg, R); return <line key={"l" + i} x1="0" y1="0" x2={x} y2={y} stroke="rgba(10,12,16,.55)" strokeWidth="1.4" />; })}
          {n > 1 && items.map((_, i) => { const [x, y] = pt(i * seg, R - 4); return <circle key={"p" + i} cx={x} cy={y} r="3.2" fill="#f4f6fa" stroke="rgba(0,0,0,.5)" strokeWidth=".8" />; })}
        </g>

        <circle r={R} fill="url(#wh-shade)" pointerEvents="none" />
        <path d={`M${-R * 0.86},-8 A${R},${R} 0 0 1 ${R * 0.86},-8 A${R * 1.6},${R * 1.6} 0 0 0 ${-R * 0.86},-8 Z`} fill="url(#wh-gloss)" opacity=".55" pointerEvents="none" />

        {/* The hub stays still and always reads SPIN; it only pulses (a ring, no transforms) when it can be tapped. */}
        <g className={`hub ${onHub && phase !== "spinning" ? "live" : ""}`} onClick={phase !== "spinning" ? onHub : undefined} role={onHub ? "button" : undefined} aria-label={onHub ? "Spin" : undefined} aria-disabled={phase === "spinning"}>
          <circle r="34" className="hub-ring" fill="none" stroke="#d4ff3a" strokeWidth="3" />
          <circle r="30" fill="#07090c" />
          <circle r="26" fill="url(#wh-hub)" stroke="rgba(0,0,0,.4)" strokeWidth="1" />
          <text y="1" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="900" fill="#0a0c10" letterSpacing="1" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>{hubLabel}</text>
        </g>
      </svg>
    </div>
  );
}
