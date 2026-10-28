import { useEffect, useMemo, useState } from "react";
import { Sparkles, Wand2, AlertTriangle, Info, Check, Save, Trash2, RotateCcw, FlaskConical } from "lucide-react";
import { CLUB_FORMAT, check, plan, headline, describe, isClubFormat } from "../lib/format.js";
import { getPin, LOCAL, lsGet, lsSet } from "../lib/store.js";
import { courtCount } from "../lib/engine.js";
import { toast } from "../components/ui.jsx";

const EXAMPLES = [
  "Same as today, but 10 teams in 2 groups of 5",
  "16 singles players, straight knockout, games to 21 with a cap at 30",
  "4 teams of 2 men and 2 women: men's, women's and two mixed doubles, a decider if it's 2–2, then a final"
];
const DRAFTS = "bt_ai_drafts";

// Samples for trying the review screen without the AI (local test mode, or no API key yet).
const SAMPLES = (() => {
  const a = structuredClone(CLUB_FORMAT);
  a.name = "Club Championship · 10 teams"; a.teams.count = 10;
  a.notes = ["Kept the club's 3-player teams, games and IPL playoffs.", "Groups of 5 mean each team plays 4 group matches."];
  const b = structuredClone(CLUB_FORMAT);
  Object.assign(b, {
    name: "Singles Open", teams: { count: 16, roster: [{ slot: "p1", label: "Player", gender: "any" }], formation: "random_draw" },
    tie: { games: [{ label: "Singles", players: ["p1"] }], ifLevel: "none" }, game: { pointsTo: 21, winBy: 2, cap: 30 },
    groups: { count: 0, rounds: 0 }, playoffs: [{ name: "Singles Open", format: "knockout", positions: [] }],
    venue: { courts: 4, start: "09:00", minutesPerGame: 20 }, notes: ["Assumed a random draw, as no seeding was mentioned."]
  });
  const c = structuredClone(CLUB_FORMAT);
  Object.assign(c, {
    name: "Mixed Fours", teams: { count: 4, roster: [
      { slot: "m1", label: "Man 1", gender: "M" }, { slot: "m2", label: "Man 2", gender: "M" },
      { slot: "w1", label: "Woman 1", gender: "F" }, { slot: "w2", label: "Woman 2", gender: "F" }], formation: "balanced_draw" },
    tie: { games: [
      { label: "Men's doubles", players: ["m1", "m2"] }, { label: "Women's doubles", players: ["w1", "w2"] },
      { label: "Mixed 1", players: ["m1", "w1"] }, { label: "Mixed 2", players: ["m2", "w2"] }], ifLevel: "decider_game" },
    groups: { count: 1, rounds: 1 }, playoffs: [{ name: "Final", format: "final_only", positions: [1, 2] }],
    notes: ["One league of 4, then 1st plays 2nd in the final.", "Kept games to 15 and 4 courts from the club format."]
  });
  return [a, b, c];
})();

const loadDrafts = () => { try { return JSON.parse(lsGet(DRAFTS)) || []; } catch (e) { return []; } };

export default function AIPlanner({ S }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState("");
  const [cfg, setCfg] = useState(null);
  const [source, setSource] = useState("");
  const [drafts, setDrafts] = useState(loadDrafts);
  const players = { men: S.players.filter(p => p.on && p.g === "M").length, women: S.players.filter(p => p.on && p.g === "F").length };
  const canAI = !!getPin();

  useEffect(() => {
    if (!busy) return;
    setSecs(0);
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const generate = async () => {
    if (!text.trim()) { setErr("Describe the tournament first."); return; }
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-pin": getPin() },
        body: JSON.stringify({ description: text, context: { ...players, courts: courtCount(S) } })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.config) throw new Error(j.error || "error " + r.status);
      setCfg(j.config); setSource("AI · " + (j.model || "Claude"));
    } catch (e) { setErr(e.message === "Failed to fetch" ? "Could not reach the server. Check the connection." : e.message); }
    setBusy(false);
  };
  const open = (c, src) => { setCfg(structuredClone(c)); setSource(src); setErr(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const save = () => {
    const d = [{ at: Date.now(), prompt: text, cfg }, ...drafts.filter(x => JSON.stringify(x.cfg) !== JSON.stringify(cfg))].slice(0, 10);
    setDrafts(d); lsSet(DRAFTS, JSON.stringify(d)); toast("Draft saved on this device");
  };
  const remove = at => { const d = drafts.filter(x => x.at !== at); setDrafts(d); lsSet(DRAFTS, JSON.stringify(d)); };

  return (
    <>
      <div className="banner"><Sparkles size={18} /><div>Describe a tournament and AI drafts its format: teams, games, groups, playoffs and timing. It's a plan to review; <b>the current tournament is not changed</b>.</div></div>

      <div className="card">
        <label className="lbl" style={{ marginTop: 0 }} htmlFor="ai-text">Describe your tournament</label>
        <textarea id="ai-text" className="field ai-text" rows={4} maxLength={2000} value={text} onChange={e => setText(e.target.value)}
          placeholder="e.g. 12 teams of 2 men and 1 woman, 3 groups, top 2 into a knockout, games to 21, 5 courts from 8:30" />
        <div className="ai-examples">
          {EXAMPLES.map(x => <button key={x} className="chip" onClick={() => setText(x)}>{x}</button>)}
        </div>
        {canAI
          ? <button className="btn primary block" style={{ marginTop: 10 }} onClick={generate} disabled={busy}>
              {busy ? <><span className="spinner" />Designing… {secs}s</> : <><Wand2 size={16} />Generate with AI</>}
            </button>
          : <p className="hint">{LOCAL ? "Local test mode has no server, so the AI is off. Try the samples below." : "Log in with the organizer PIN to use the AI."}</p>}
        {busy && <p className="hint" style={{ marginBottom: 0 }}>Claude is working out the format. This usually takes 10–40 seconds.</p>}
        {err && <div className="banner warn" style={{ marginTop: 10, marginBottom: 0 }}><AlertTriangle size={18} /><div>{err}</div></div>}
        <div className="ai-samples">
          <small><FlaskConical size={12} />Samples, no AI:</small>
          {SAMPLES.map(s => <button key={s.name} className="btn sm" onClick={() => open(s, "Sample")}>{s.name}</button>)}
          <button className="btn sm" onClick={() => open(CLUB_FORMAT, "Club format")}>Today's format</button>
        </div>
      </div>

      {cfg && <Review cfg={cfg} setCfg={setCfg} source={source} players={players} onSave={save} onAgain={canAI && text.trim() ? generate : null} busy={busy} />}

      {drafts.length > 0 && (
        <>
          <div className="section"><h2>Saved drafts</h2><span>On this device</span></div>
          <div className="card flat">
            {drafts.map(d => (
              <div key={d.at} className="ai-draft">
                <button onClick={() => { setText(d.prompt || ""); open(d.cfg, "Saved draft"); }}>
                  <b>{d.cfg.name}</b>
                  <small>{new Date(d.at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}{d.prompt ? " · " + d.prompt : ""}</small>
                </button>
                <button className="icon-btn" aria-label="Delete draft" onClick={() => remove(d.at)}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// Quick edits for the numbers people most often change; everything is re-checked as they type.
const EDITS = [
  ["Teams", c => c.teams.count, (c, v) => { c.teams.count = v; }],
  ["Groups", c => c.groups.count, (c, v) => { c.groups.count = v; if (v && !c.groups.rounds) c.groups.rounds = 1; if (!v) c.groups.rounds = 0; }],
  ["Courts", c => c.venue.courts, (c, v) => { c.venue.courts = v; }],
  ["Points to win", c => c.game.pointsTo, (c, v) => { c.game.pointsTo = v; }],
  ["Min per game", c => c.venue.minutesPerGame, (c, v) => { c.venue.minutesPerGame = v; }]
];

function Review({ cfg, setCfg, source, players, onSave, onAgain, busy }) {
  const { errors, warnings } = useMemo(() => check(cfg, players), [cfg, players.men, players.women]);
  const p = useMemo(() => (errors.length ? null : plan(cfg)), [cfg, errors.length]);
  const edit = fn => setCfg(c => { const n = structuredClone(c); fn(n); return n; });
  const num = v => (v === "" ? 0 : Math.max(0, Math.min(99, Math.round(+v) || 0)));

  return (
    <>
      <div className="section"><h2>Draft format</h2><span>{source}</span></div>
      <div className="card ai-plan">
        <input className="ai-name" value={cfg.name} aria-label="Tournament name" onChange={e => edit(c => { c.name = e.target.value; })} />
        {p && <div className="ai-headline">{headline(cfg, p)}</div>}
        {errors.length > 0 && <div className="banner warn"><AlertTriangle size={18} /><div><b>Can't run as it is</b>{errors.map(x => <div key={x}>{x}</div>)}</div></div>}
        {p && <ul className="ai-lines">{describe(cfg, p).map(x => <li key={x}>{x}</li>)}</ul>}
        {warnings.length > 0 && <div className="banner warn"><Info size={18} /><div><b>Check</b>{warnings.map(x => <div key={x}>{x}</div>)}</div></div>}
        {cfg.notes.length > 0 && <div className="banner"><Sparkles size={18} /><div><b>Assumptions</b>{cfg.notes.map(x => <div key={x}>{x}</div>)}</div></div>}
        {isClubFormat(cfg) && !errors.length && <div className="banner ok"><Check size={18} /><div>This is the format the app runs today.</div></div>}

        <label className="lbl">Adjust</label>
        <div className="ai-edits">
          {EDITS.map(([label, get, set]) => (
            <label key={label}><small>{label}</small>
              <input className="field" type="number" inputMode="numeric" value={get(cfg)} onChange={e => edit(c => set(c, num(e.target.value)))} />
            </label>
          ))}
          <label><small>Start</small><input className="field" type="time" value={cfg.venue.start} onChange={e => edit(c => { c.venue.start = e.target.value; })} /></label>
        </div>

        <div className="btns">
          <button className="btn primary" onClick={onSave} disabled={errors.length > 0}><Save size={16} />Save draft</button>
          {onAgain && <button className="btn" onClick={onAgain} disabled={busy}><RotateCcw size={16} />Generate again</button>}
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>Running a new format in the app is the next step. For now the tournament keeps the club format, and drafts are saved on this device only.</p>
      </div>

      {p && (
        <>
          <div className="section"><h2>Fixtures</h2><span>{p.ties} matches</span></div>
          <div className={p.groups.length > 1 ? "pair" : ""}>
            {p.groups.map(g => (
              <details key={g.name} className="card ai-fx" open={p.groups.length <= 2}>
                <summary><b>{g.name}</b><span>{g.teams.length} teams · {g.ties} {g.ties === 1 ? "match" : "matches"}</span></summary>
                <p className="hint">{g.teams.join(", ")}</p>
                {g.rounds.map((r, i) => (
                  <div key={i} className="ai-round"><small>Round {i + 1}</small>{r.map(([a, b]) => <span key={a + b}>{a} v {b}</span>)}</div>
                ))}
              </details>
            ))}
          </div>
          {p.brackets.map(b => (
            <details key={b.name} className="card ai-fx" open>
              <summary><b>{b.name}</b><span>{b.n} teams · {b.ties} {b.ties === 1 ? "match" : "matches"}</span></summary>
              <div className="ai-round"><small>First round</small>{b.first.map(([x, y, l]) => <span key={x + y}>{l ? l + ": " : ""}{x} v {y}</span>)}</div>
            </details>
          ))}
        </>
      )}

      <details className="card ai-fx">
        <summary><b>Config</b><span>For the next step</span></summary>
        <pre className="ai-json">{JSON.stringify(cfg, null, 2)}</pre>
      </details>
    </>
  );
}
