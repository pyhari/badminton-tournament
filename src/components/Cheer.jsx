import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { aiOn, tn } from "../lib/engine.js";
import { funFact } from "../lib/funFacts.js";
import { confetti } from "./Confetti.jsx";

const asked = new Map(); // player|team -> the AI message (a promise), one request per page

// The pop-up when a player picks their name: their fun fact, revealed with a burst, and a
// short cheer from the AI (a plain line without it). Needs a <ConfettiLayer /> on the page.
export function useCheer(S) {
  const [cheer, setCheer] = useState(null); // { name, t, text }
  const show = (name, t) => {
    if (!name) return setCheer(null);
    setCheer({ name, t, text: null });
    const plain = t >= 0 ? "Have a great day on court with your team!" : "Find your team here the moment it's drawn. Have a great day on court!";
    if (!aiOn(S, "pep")) return setCheer({ name, t, text: plain });
    const k = name + "|" + t;
    if (!asked.has(k)) asked.set(k, fetch("/api/pep?name=" + encodeURIComponent(name)).then(r => r.json()).then(j => j.text || null, () => null));
    asked.get(k).then(text => { if (!text) asked.delete(k); return text || plain; })
      .then(text => setCheer(c => c && c.name === name ? { ...c, text } : c));
  };
  return [cheer, show];
}

export default function Cheer({ S, cheer, onClose }) {
  const fact = cheer && funFact(cheer.name);
  const [open, setOpen] = useState(false); // the fun fact card has burst open
  const card = useRef(null);
  useEffect(() => {
    if (!cheer) return;
    setOpen(false);
    // A short build-up, then the burst.
    const t = setTimeout(() => {
      setOpen(true);
      const r = card.current && card.current.getBoundingClientRect();
      if (r) confetti(r.left + r.width / 2, r.top + r.height / 2);
      if (navigator.vibrate) navigator.vibrate(25);
    }, 650);
    return () => clearTimeout(t);
  }, [cheer && cheer.name]); // eslint-disable-line react-hooks/exhaustive-deps
  // Closes by itself once there has been time to read it.
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    if (!cheer || !cheer.text || !open) return;
    const t = setTimeout(() => close.current(), 14000);
    return () => clearTimeout(t);
  }, [cheer, open]);
  if (!cheer) return null;
  return (
    <div className="pd-pep" role="status" key={cheer.name}>
      <div className="pep-top">
        <Sparkles size={18} />
        <b>{cheer.t >= 0 ? `You're in ${tn(S, cheer.t)}, ${cheer.name}!` : `You're in, ${cheer.name}!`}</b>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      {fact && (
        <div ref={card} className={`fact ${open ? "open" : ""}`}>
          <small>Fun fact</small>
          {open ? <p>{fact}</p> : <p className="fact-seal" aria-label="Revealing">✦ ✦ ✦</p>}
        </div>
      )}
      {cheer.text ? <p className="pep-msg">{cheer.text}</p> : <p className="pd-dots"><span /><span /><span /></p>}
    </div>
  );
}
