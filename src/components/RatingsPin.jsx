import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import { update } from "../lib/store.js";
import { Sheet, toast } from "./ui.jsx";

// The PIN that guards the secret player ratings (Setup > Players). It is set once and shared by
// every organizer device: only a salted, slow hash is saved with the tournament, never the PIN.
const ROUNDS = 150000;
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
async function hashPin(pin, salt) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: ROUNDS, hash: "SHA-256" }, key, 256);
  return hex(bits);
}
export const hasRatingsPin = S => !!(S.settings && S.settings.lvPin && S.settings.lvPin.hash);

// Asks for the PIN (or, the first time, sets one) and calls onOpen when it is right.
export default function RatingsPin({ S, onOpen, onClose }) {
  const create = !hasRatingsPin(S);
  const [a, setA] = useState(""), [b, setB] = useState(""), [busy, setBusy] = useState(false);
  const go = async e => {
    e.preventDefault();
    if (busy) return;
    if (create && a.length < 4) return toast("Use at least 4 digits.");
    if (create && a !== b) return toast("The two PINs do not match.");
    setBusy(true);
    try {
      if (create) {
        const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
        const hash = await hashPin(a, salt);
        update(n => { n.settings = { ...n.settings, lvPin: { salt, hash } }; });
        onOpen();
      } else if (await hashPin(a, S.settings.lvPin.salt) === S.settings.lvPin.hash) onOpen();
      else { toast("Wrong PIN."); setA(""); }
    } finally { setBusy(false); }
  };
  const field = (v, set, label, auto) => <input className="field pin" type="password" inputMode="numeric" autoComplete="off" placeholder={label} aria-label={label} value={v} autoFocus={auto} onChange={e => set(e.target.value.replace(/\D/g, "").slice(0, 8))} />;
  return (
    <Sheet onClose={onClose}>
      <div className="sheet-head"><h3>{create ? "Set a ratings PIN" : "Ratings PIN"}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      <p className="hint" style={{ marginTop: 0 }}>{create
        ? "Choose a PIN (4 to 8 digits), different from the organizer PIN. It is needed to see the player ratings on any organizer phone."
        : "Enter the ratings PIN to see the player ratings until this page is closed."}</p>
      <form onSubmit={go} className="pinform">
        {field(a, setA, create ? "New PIN" : "PIN", true)}
        {create && field(b, setB, "Same PIN again")}
        <button className="btn primary block" disabled={busy}><KeyRound size={16} />{busy ? "Checking…" : create ? "Set PIN and show" : "Show ratings"}</button>
      </form>
    </Sheet>
  );
}
