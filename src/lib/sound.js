// Small synthesized sounds for the draw: a peg tick, a win chime, and for the auto draw
// a countdown beep, a whoosh for each pot, a drumroll while the wheel spins and a fanfare.
import { lsGet, lsSet } from "./store.js";

let ctx = null;
const audio = () => {
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
};
export const soundOn = () => lsGet("bt_sound") !== "off";
export const setSound = on => lsSet("bt_sound", on ? "" : "off");

function tone(freq, start, len, vol, type = "sine") {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + len + 0.02);
}
export function tick() { if (soundOn()) tone(1900, 0, 0.035, 0.08, "square"); }
export function chime() {
  if (!soundOn()) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.5, 0.16, "triangle"));
}
// A burst of filtered noise; sweep moves the filter to "to" Hz (a whoosh).
function noise(start, len, vol, freq, to) {
  const c = audio(); if (!c) return;
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + start;
  src.buffer = b; f.type = "bandpass"; f.Q.value = 1.2;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + len);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t); src.stop(t + len + 0.02);
}
export function beep(go) { if (soundOn()) tone(go ? 1046.5 : 587.33, 0, go ? 0.5 : 0.2, 0.2, "triangle"); }
export function whoosh() { if (soundOn()) noise(0, 0.55, 0.35, 300, 3200); }
// Snare-like hits that get louder over ms milliseconds.
export function drumroll(ms) {
  if (!soundOn()) return;
  const n = Math.floor(ms / 50);
  for (let i = 0; i < n; i++) noise(i * 0.05, 0.045, 0.04 + 0.16 * (i / n) ** 2, 1900);
}
export function fanfare() {
  if (!soundOn()) return;
  [[523.25, 0], [523.25, 0.14], [523.25, 0.28], [698.46, 0.42], [880, 0.8], [1046.5, 1.0]].forEach(([f, t], i) => tone(f, t, i > 3 ? 0.9 : 0.16, 0.17, "triangle"));
  [523.25, 659.25, 783.99].forEach(f => tone(f, 1.0, 1.1, 0.09, "sine"));
}
// Call from a tap so browsers allow sound later in the animation.
export const unlock = () => { if (soundOn()) audio(); };
