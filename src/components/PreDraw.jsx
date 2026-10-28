import { useEffect, useState } from "react";
import { Search, Sparkles, Check, X } from "lucide-react";
import { NT, tn } from "../lib/engine.js";
import { lsGet, lsSet } from "../lib/store.js";
import { Badge, teamColor } from "./ui.jsx";
import { ConfettiLayer, confetti } from "./Confetti.jsx";

// The players' page before the groups are drawn: everyone who is playing, popping in one
// by one, and the 8 teams as "?" until the team draw is done. A player can pick their name
// now; once the teams are set, their team lights up (and stays picked on the Me tab).
export default function PreDraw({ S, me, choose }) {
  const [q, setQ] = useState("");
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

  let n = 0; // running index, so the chips pop in one after another
  const chip = p => (
    <button key={p.name} className={`pd-chip ${p.g === "F" ? "f" : "m"} ${p.name === name ? "me" : ""}`} style={{ "--i": n++ }}
      onClick={() => choose(p.name === name ? "" : "|" + p.name)} aria-pressed={p.name === name}>
      <i>{p.name[0]}</i>{p.name}{p.name === name && <Check size={14} strokeWidth={3} />}
    </button>
  );
  const group = (label, list) => shown(list).length > 0 && (
    <>
      <div className="pd-label"><span className={`gd ${label === "Women" ? "f" : "m"}`} />{label} · {list.length}</div>
      <div className="pd-wall">{shown(list).map(chip)}</div>
    </>
  );

  return (
    <div className="page">
      <ConfettiLayer />
      <div className="pd-hero">
        <div className="pd-stats">
          <div><b className="num">{playing.length}</b><small>players</small></div>
          <div><b className="num">{NT}</b><small>teams</small></div>
          <div><b className="num">2</b><small>trophies</small></div>
        </div>
        <p><Sparkles size={14} />{set ? "Teams are set. The group draw is coming soon." : "The team draw is coming soon. Who will you team up with?"}</p>
      </div>

      {name && (
        <div className={`pd-you ${mine >= 0 ? "in" : ""}`} style={mine >= 0 ? { "--tc": teamColor(mine) } : undefined}>
          {mine >= 0
            ? <><Badge S={S} t={mine} /><div><small>That's you, {name}!</small><b>{tn(S, mine)}</b><span>with {[S.teams[mine].m1, S.teams[mine].m2, S.teams[mine].w].filter(x => x !== name).join(" and ")}</span></div></>
            : <><span className="pd-q">?</span><div><small>You're {name}</small><b>Waiting for the draw</b><span>Your team lights up here the moment you're drawn.</span></div></>}
          <button className="icon-btn" onClick={() => choose("")} aria-label="Not me"><X size={16} /></button>
        </div>
      )}

      <div className="section"><h2>The teams</h2></div>
      <div className="pd-teams">
        {S.teams.slice(0, NT).map((x, t) => set ? (
          <div key={t} className={`pd-team on ${t === mine ? "mine" : ""}`} style={{ "--tc": teamColor(t), "--i": t }}>
            <Badge S={S} t={t} size="sm" /><div><b>{tn(S, t)}</b><span>{x.m1} · {x.m2} · {x.w}</span></div>
          </div>
        ) : (
          <div key={t} className="pd-team" style={{ "--i": t }}><span className="pd-q">?</span><span className="pd-q">?</span><span className="pd-q">?</span></div>
        ))}
      </div>

      <div className="section"><h2>Who's playing</h2></div>
      {!name && <p className="page-sub">Tap your name, and we'll show your team as soon as it's drawn.</p>}
      <div className="search"><Search size={18} /><input className="field" placeholder="Find your name" value={q} onChange={e => setQ(e.target.value)} /></div>
      {group("Women", women)}
      {group("Men", men)}
      {q && !shown(playing).length && <p className="hint">No player called “{q}”.</p>}
    </div>
  );
}
