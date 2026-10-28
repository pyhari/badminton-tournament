import { useState } from "react";
import { Search, Users, Repeat2, MapPin } from "lucide-react";
import { allMatches, courtOf, groups, onCourt, prelimsDone, ready, res, table, tn, tp } from "../lib/engine.js";
import { lsGet, lsSet } from "../lib/store.js";
import { Badge, Empty, MatchCard, teamColor } from "../components/ui.jsx";
import Story from "../components/Story.jsx";

const ord = n => n + (["th", "st", "nd", "rd"][n] || "th");

export default function Me({ S }) {
  const [me, setMe] = useState(lsGet("bt_me") || "");
  const [q, setQ] = useState("");
  const g = groups(S);
  if (!g) return <div className="page"><Empty icon={Users} title="Teams not drawn yet">This page updates by itself. Check back soon.</Empty></div>;
  const choose = v => { lsSet("bt_me", v); setMe(v); setQ(""); };
  const idx = me ? parseInt(me.split("|")[0], 10) : NaN;

  if (isNaN(idx) || !S.teams[idx]) {
    const names = [];
    S.teams.forEach((t, i) => [t.m1, t.m2, t.w].forEach(n => n && names.push([n, i])));
    names.sort((a, b) => a[0].localeCompare(b[0]));
    const shown = names.filter(([n]) => n.toLowerCase().includes(q.trim().toLowerCase()));
    return (
      <div className="page">
        <h1 className="page-title">Find your team</h1>
        <p className="page-sub">Pick your name to see your next match, court and results.</p>
        <Story />
        <div className="search"><Search size={18} /><input className="field" placeholder="Search your name" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="namelist">
          {shown.map(([n, i]) => <button key={n + i} onClick={() => choose(i + "|" + n)}><Badge S={S} t={i} size="sm" />{n}</button>)}
          {!shown.length && <p className="hint">No player called “{q}”.</p>}
        </div>
        <div className="section"><h2>Or pick a team</h2></div>
        <div className="namelist">{S.teams.map((t, i) => <button key={i} onClick={() => choose(i + "|")}><Badge S={S} t={i} size="sm" />{tn(S, i)}</button>)}</div>
      </div>
    );
  }

  const name = me.split("|")[1];
  const mine = allMatches(S).filter(m => m.a === idx || m.b === idx);
  const gk = g.A.includes(idx) ? "A" : "B";
  const tbl = table(S, gk), pos = tbl.findIndex(x => x.t === idx), rec = tbl[pos];
  const opp = m => (m.a === idx ? m.b : m.a);
  const now = mine.find(m => onCourt(S, m));
  const todo = mine.filter(m => ready(m) && !res(S, m).done && m !== now);
  return (
    <div className="page">
      <div className="section" style={{ marginTop: 14 }}><h2>{name ? "Hi " + name : "Your team"}</h2><button className="btn sm" onClick={() => choose("")}><Repeat2 size={14} />Change</button></div>
      <div className="hero" style={{ background: `linear-gradient(135deg, ${teamColor(idx)}, color-mix(in srgb, ${teamColor(idx)} 70%, #ffffff))` }}>
        <div className="hero-top"><Badge S={S} t={idx} size="lg" /><div><b>{tn(S, idx)}</b><span>{tp(S, idx)}</span></div></div>
        <div className="hero-stats">
          <div><b>{ord(pos + 1)}</b><small>Group {gk}</small></div>
          <div><b>{rec.w}–{rec.l}</b><small>Ties W–L</small></div>
          <div><b>{rec.pd > 0 ? "+" : ""}{rec.pd}</b><small>Pt diff</small></div>
        </div>
      </div>
      {now ? (
        <div className="next">
          <div className="k"><span className="dot live" />On court now · {now.stage}{now.label ? " · " + now.label : ""}</div>
          <div className="big"><b>{courtOf(S, now) ? "Court " + courtOf(S, now) : "Playing"}</b></div>
          <div className="opp"><span className="hint" style={{ margin: 0 }}>vs</span><Badge S={S} t={opp(now)} /><span>{tn(S, opp(now))}</span></div>
        </div>
      ) : todo.length ? (
        <div className="next">
          <div className="k" style={{ color: "var(--muted)" }}><MapPin size={12} />Still to play · {todo.length}</div>
          <div className="todo">{todo.map(m => <div key={m.id}><span className="hint" style={{ margin: 0, width: 22 }}>vs</span><Badge S={S} t={opp(m)} size="sm" />{tn(S, opp(m))}<span className="hint" style={{ margin: "0 0 0 auto" }}>{m.label || m.stage}</span></div>)}</div>
          <p className="hint" style={{ marginBottom: 0 }}>Ties are called to a free court in any order. This page shows your court as soon as you are called.</p>
        </div>
      ) : (
        <div className="next"><div className="k" style={{ color: "var(--muted)" }}><MapPin size={12} />No tie waiting</div><p className="hint" style={{ marginBottom: 0 }}>{prelimsDone(S) ? "Check Playoffs for what comes next." : "Wait for the other group ties to finish."}</p></div>
      )}
      <Story />
      <div className="section"><h2>Your ties</h2></div>
      {mine.map(m => <MatchCard key={m.id} S={S} m={m} />)}
      <p className="hint">Playoff matches appear here when your team qualifies.</p>
    </div>
  );
}
