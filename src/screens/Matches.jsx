import { useState } from "react";
import { CalendarClock, PartyPopper, X, SearchX } from "lucide-react";
import { STAGES, allMatches, courtOf, groups, onCourt, pickedTeam, prelimsDone, res, tn, tp } from "../lib/engine.js";
import { lsGet, lsSet } from "../lib/store.js";
import { Badge, Empty, MatchCard } from "../components/ui.jsx";
import Story from "../components/Story.jsx";

// Upcoming means not finished yet, so matches being played stay in view.
const STATUS = [["all", "All"], ["up", "Not played"], ["done", "Played"]];
// Each match has 3 games. A match shows under Played if any game is finished
// and under Not played if any game is left, so a half-played match is in both.
const gamesDone = (S, m) => m.a == null || m.b == null ? 0 : res(S, m).gs.filter(Boolean).length;
const inStatus = (S, m, s) => s === "all" || (s === "done" ? gamesDone(S, m) > 0 : gamesDone(S, m) < 3);

// Filters are remembered on this device.
const saved = () => { try { return JSON.parse(lsGet("bt_filter")) || {}; } catch (e) { return {}; } };

export default function Matches({ S, admin, onOpen }) {
  const all = allMatches(S);
  const [f, setF] = useState(() => { const v = { team: null, status: "all", ...saved() }; if (!STATUS.some(s => s[0] === v.status)) v.status = "all"; return v; });
  // Group stage or playoffs: the one being played, unless picked here.
  const [stagePick, setStage] = useState(null);
  if (!groups(S)) return <div className="page"><Empty icon={CalendarClock} title="No matches yet">{admin ? "Draw the groups in Setup to build the fixtures." : "The groups have not been drawn. This page updates by itself."}</Empty></div>;

  const set = patch => { const n = { ...f, ...patch }; setF(n); lsSet("bt_filter", JSON.stringify(n)); };
  const team = f.team != null && S.teams[f.team] ? f.team : null;
  const filtered = team != null || f.status !== "all";
  const mine = (() => { const me = pickedTeam(S, lsGet("bt_me")); return isNaN(me) ? null : me; })();
  const teamOrder = [...S.teams.keys()].sort((a, b) => (b === mine) - (a === mine));
  const stage = stagePick || (prelimsDone(S) ? "po" : "groups");
  const inStage = st => all.filter(m => (st === "po") === !!m.br);
  const shown = inStage(stage);
  const byTeam = team == null ? shown : shown.filter(m => m.a === team || m.b === team);
  const nLive = byTeam.filter(m => { const d = gamesDone(S, m); return d > 0 && d < 3; }).length;

  // Each stage button carries its own progress, so there is no separate progress card.
  const stageInfo = st => {
    const ms = inStage(st).filter(m => team == null || m.a === team || m.b === team);
    const done = ms.filter(m => res(S, m).done).length;
    return { done, n: ms.length, pct: ms.length ? (done / ms.length) * 100 : 0 };
  };
  const filters = (
    <div className="filters">
      <div className="fseg stages" role="radiogroup" aria-label="Stage">
        {[["groups", "Group stage"], ["po", "Playoffs"]].map(([k, n]) => {
          const x = stageInfo(k);
          return (
            <button key={k} role="radio" aria-checked={stage === k} className={stage === k ? "on" : ""} onClick={() => setStage(k)}>
              <b>{n}</b><small className="num">{x.done} of {x.n} played</small>
              <i className="sbar" aria-hidden="true"><span style={{ width: x.pct + "%" }} /></i>
            </button>
          );
        })}
      </div>
      <div className="fstat" role="group" aria-label="Show matches">
        {[["all", "All", byTeam.length], ["done", "Played", byTeam.filter(m => gamesDone(S, m) > 0).length], ["up", "Not played", byTeam.filter(m => gamesDone(S, m) < 3).length]].map(([k, n, c]) => (
          <button key={k} className={f.status === k ? "on" : ""} aria-pressed={f.status === k} onClick={() => set({ status: k })}>{n}<span className="num">{c}</span></button>
        ))}
        {nLive > 0 && <span className="fstat-live"><span className="dot live" />{nLive} on court</span>}
      </div>
      <div className={`fteams ${team != null ? "picked" : ""}`} role="radiogroup" aria-label="Team">
        <button role="radio" aria-checked={team == null} className={`all ${team == null ? "on" : ""}`} onClick={() => set({ team: null })}>All</button>
        {teamOrder.map(t => (
          <button key={t} role="radio" aria-checked={team === t} aria-label={tn(S, t)} title={tn(S, t)}
            className={`${team === t ? "on" : ""} ${t === mine ? "mine" : ""}`} onClick={() => set({ team: team === t ? null : t })}>
            <Badge S={S} t={t} size="sm" />
          </button>
        ))}
      </div>
      {team != null && <p className="fteam-line"><b>{tn(S, team)}</b>{team === mine && <em>My team</em>}<span>{tp(S, team)}</span></p>}
    </div>
  );

  const list = byTeam.filter(m => inStatus(S, m, f.status));
  const live = list.filter(m => onCourt(S, m)).sort((x, y) => (courtOf(S, x) || 99) - (courtOf(S, y) || 99));
  const finished = all.length > 0 && all.every(m => res(S, m).done);
  const card = m => <MatchCard key={m.id} S={S} m={m} onOpen={onOpen} />;
  return (
    <div className="page wide">
      <div className="title-row"><h1 className="page-title">Matches</h1>{filtered && <button className="btn sm" onClick={() => set({ team: null, status: "all" })}><X size={14} />Clear</button>}</div>
      {!admin && !filtered && <Story S={S} />}
      {filters}
      {finished && <div className="banner ok"><PartyPopper size={18} /> Tournament finished. Congratulations to the winners!</div>}
      {!list.length && <Empty icon={SearchX} title="Nothing here">{f.status === "up" ? "Every game has been played." : "No games played yet."}</Empty>}
      {live.length > 0 && (
        <>
          <div className="section"><h2 className="live-h"><span className="dot live" />On court now</h2><span>{live.length} {live.length === 1 ? "match" : "matches"}</span></div>
          <div className="cards">{live.map(card)}</div>
        </>
      )}
      {STAGES.map(stage => {
        const ms = list.filter(m => m.stage === stage && !onCourt(S, m));
        if (!ms.length) return null;
        const inStage = byTeam.filter(m => m.stage === stage), done = inStage.filter(m => res(S, m).done).length;
        return (
          <div key={stage}>
            <div className="section"><h2>{stage}</h2><span>{done}/{inStage.length} played</span></div>
            <div className="cards">{ms.map(m => <MatchCard key={m.id} S={S} m={m} onOpen={onOpen} showStage={false} />)}</div>
          </div>
        );
      })}
      {stage === "po" && !prelimsDone(S) && <p className="hint">The playoffs start once every group match is played. Teams fill in from the final standings.</p>}
      {stage === "po" && team != null && f.status !== "done" && <p className="hint">Playoff matches appear once a team qualifies.</p>}
    </div>
  );
}
