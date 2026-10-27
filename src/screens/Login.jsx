import { useState } from "react";
import { LockKeyhole, Radio } from "lucide-react";
import { LOCAL, login, localMode } from "../lib/store.js";

export default function Login() {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async e => {
    e.preventDefault();
    setBusy(true); setMsg("");
    const err = await login(pin);
    setBusy(false); setMsg(err);
  };
  return (
    <form className="login" onSubmit={go}>
      <div className="brand-mark"><LockKeyhole size={28} /></div>
      <h1>Organizer</h1>
      <p>Setup and score entry are for the organizer. Enter the admin PIN.</p>
      <input className="field" type="password" placeholder="Admin PIN" autoComplete="current-password" autoFocus value={pin} onChange={e => setPin(e.target.value)} />
      <div className="btns"><button className="btn primary block" disabled={busy}>{busy ? "Checking…" : "Log in"}</button></div>
      {LOCAL && <div className="btns"><button type="button" className="btn block" onClick={localMode}>Local test mode</button></div>}
      <div className="err" role="alert">{msg}</div>
      <a className="btn block" href="/watch" style={{ marginTop: 24, textDecoration: "none" }}><Radio size={16} />Follow live scores instead</a>
    </form>
  );
}
