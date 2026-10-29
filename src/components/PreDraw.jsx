import { useEffect, useState } from "react";
import { Search, Sparkles, Check, X } from "lucide-react";
import { NT, aiOn, tn } from "../lib/engine.js";
import { lsGet, lsSet } from "../lib/store.js";
import { Badge, TeamName, teamColor } from "./ui.jsx";
import { ConfettiLayer, confetti } from "./Confetti.jsx";

// The players' page before the groups are drawn: everyone who is playing, popping in one
// by one, and the 8 teams as "?" until the team draw is done. A player can pick their name
// now; once the teams are set, their team lights up (and stays picked on the Me tab).
const asked = new Map(); // player|team -> the AI message (a promise)

export default function PreDraw({ S, me, choose }) {
  const [q, setQ] = useState("");
  const [pep, setPep] = useState(null); // { name, text } for the pop-up after picking a name
  const name = (me || "").split("|")[1] || "";
  const playing = S.players.filter(p => p.on);
  const women = playing.filter(p => p.g === "F"), men = playing.filter(p => p.g !== "F");
  const set = S.locked && S.teams.every(x => x.m1 && x.m2 && x.w);
  const mine = set && name ? S.teams.findIndex(x => [x.m1, x.m2, x.w].includes(name)) : -1;
  const shown = list => list.filter(p => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  // Confetti the first time this phone sees its player's team.
  useEffect(() => {
    if (mine < 0) return;
    const k = name + "|" + mine;
    if (lsGet("bt_seen_team") === k) return;
    lsSet("bt_seen_team", k);
    const t = setTimeout(() => confetti(innerWidth / 2, innerHeight * 0.35), 400);
    return () => clearTimeout(t);
  }, [mine, name]);

  // Picking a name: a pop-up at the bottom with a cheer from the AI (a plain one without it).
  const pick = who => {
    choose(who ? "|" + who : "");
    if (!who) return setPep(null);
    setPep({ name: who, text: null });
    const t = set ? S.teams.findIndex(x => [x.m1, x.m2, x.w].includes(who)) : -1;
    const plain = t >= 0 ? "Have a great day on court with your team!" : "Find your team here the moment it's drawn. Have a great day on court!";
    if (!aiOn(S, "pep")) return setPep({ name: who, text: plain });
    // One request per player and team on this page, however often the name is tapped.
    const k = who + "|" + t;
    if (!asked.has(k)) asked.set(k, fetch("/api/pep?name=" + encodeURIComponent(who)).then(r => r.json()).then(j => j.text || null, () => null));
    asked.get(k).then(text => { if (!text) asked.delete(k); return text || plain; })
      .then(text => setPep(p => p && p.name === who ? { name: who, text } : p));
  };
  useEffect(() => {
    if (!pep || !pep.text) return;
    const t = setTimeout(() => setPep(null), 9000);
    return () => clearTimeout(t);
  }, [pep]);

  let n = 0; // running index, so the chips pop in one after another
  const chip = p => (
    <button key={p.name} className={`pd-chip ${p.g === "F" ? "f" : "m"} ${p.name === name ? "me" : ""}`} style={{ "--i": n++ }}
      onClick={() => { pick(p.name === name ? "" : p.name); setQ(""); }} aria-pressed={p.name === name}>
      <i>{p.name[0]}</i>{p.name}{p.name === name && <Check size={14} strokeWidth={3} />}
    </button>
  );
  const group = (label, list) => (
    <>
      <div className="pd-label"><span className={`gd ${label === "Women" ? "f" : "m"}`} />{label} · {list.length}</div>
      <div className="pd-wall">{list.map(chip)}</div>
    </>
  );
  const found = q.trim() ? shown(playing).sort((a, b) => a.name.localeCompare(b.name)) : [];

  return (
    <div className="page">
      <ConfettiLayer />
      <div className="pd-hero">
        <span className="pd-soon"><i />Coming soon</span>
        <h1 className="pd-title">{set ? "The group draw" : "The team draw"}</h1>
        <p><Sparkles size={15} />{set ? "Teams are set. Which group will yours land in?" : "Who will you team up with?"}</p>
        <div className="pd-stats">
          <div><b className="num">{playing.length}</b><small>players</small></div>
          <div><b className="num">{NT}</b><small>teams</small></div>
          <div><b className="num">2</b><small>trophies</small></div>
        </div>
      </div>

      {/* Only once the player has a team; before that the banner above speaks to everyone. */}
      {mine >= 0 && (
        <div className="pd-you in" style={{ "--tc": teamColor(mine) }}>
          <Badge S={S} t={mine} /><div><small>That's you, {name}!</small><b>{tn(S, mine)}</b><span>with {[S.teams[mine].m1, S.teams[mine].m2, S.teams[mine].w].filter(x => x !== name).join(" and ")}</span></div>
          <button className="icon-btn" onClick={() => pick("")} aria-label="Not me"><X size={16} /></button>
        </div>
      )}

      {/* Finding yourself comes first: it is what each player opens the page to do. */}
      <div className="pd-find">
        {!name && <p className="pd-find-hint">Find your name, and we'll show your team the moment it's drawn.</p>}
        <div className="search"><Search size={18} /><input className="field" placeholder="Find your name" value={q} onChange={e => setQ(e.target.value)} aria-label="Find your name" /></div>
        {found.length > 0 && <div className="pd-wall pd-results">{found.map(chip)}</div>}
        {q.trim() && !found.length && <p className="hint">No player called “{q}”.</p>}
      </div>

      <div className="section"><h2>The teams</h2></div>
      <div className="pd-teams">
        {S.teams.slice(0, NT).map((x, t) => (
          <div key={t} className={`pd-team ${set ? "on" : ""} ${t === mine ? "mine" : ""}`} style={{ "--tc": teamColor(t), "--i": t }}>
            <div className="pd-team-top"><Badge S={S} t={t} size="sm" /><b>{tn(S, t)}</b>{t === mine && <em>You</em>}</div>
            {set ? <TeamName S={S} t={t} className="pd-team-nm" /> : <div className="pd-qs"><span className="pd-q">?</span><span className="pd-q">?</span><span className="pd-q">?</span></div>}
          </div>
        ))}
      </div>

      <div className="section"><h2>Who's playing</h2></div>
      {group("Women", women)}
      {group("Men", men)}
      {pep && (
        <div className="pd-pep" role="status" key={pep.name}>
          <Sparkles size={18} />
          <div><b>{mine >= 0 && pep.name === name ? `You're in ${tn(S, mine)}, ${pep.name}!` : `You're in, ${pep.name}!`}</b>
            {pep.text ? <p>{pep.text}</p> : <p className="pd-dots"><span /><span /><span /></p>}</div>
          <button className="icon-btn" onClick={() => setPep(null)} aria-label="Close"><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
