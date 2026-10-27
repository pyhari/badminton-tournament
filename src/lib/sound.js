// Small synthesized sounds for the draw: a peg tick and a win chime.
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
// Call from a tap so browsers allow sound later in the animation.
export const unlock = () => { if (soundOn()) audio(); };
