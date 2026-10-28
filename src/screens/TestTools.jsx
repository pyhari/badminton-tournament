import { useState } from "react";
import { FlaskConical, Wand2, StepForward, Flag, Trophy, RotateCcw, Eraser, Shuffle, AlertTriangle } from "lucide-react";
import * as E from "../lib/engine.js";
import { MODES, simulate, quickSetup, threeWayTie, clearScores, summary, allPlayed } from "../lib/simulate.js";
import { update, getState } from "../lib/store.js";
import { Badge, toast } from "../components/ui.jsx";

/* global __APP_ENV__ */
export const IS_PROD = __APP_ENV__ === "production";
// Shown on preview and local builds; on the live site only with ?test=1.
export const showTests = !IS_PROD || /[?&]test=1/.test(location.search);
// The AI format planner is turned off for now. To turn it back on, set AI_ON to true
// here and in api/generate.js: it then shows like the test tools, with ?ai=1 on the live site.
const AI_ON = false;
export const showAI = AI_ON && (!IS_PROD || /[?&]ai=1/.test(location.search));

export default function TestTools({ S }) {
  const [mode, setMode] = useState("random");
  const [team, setTeam] = useState(null);
  const [log, setLog] = useState([]);
  const g = E.groups(S);
  const hasScores = Object.keys(S.scores).length > 0;
  const ok = msg => !IS_PROD || confirm("This is the LIVE tournament. " + msg + "\n\nContinue?");

  const record = label => {
    const s = summary(getState());
    if (!s) return;
    setLog(l => [{ n: l.length ? l[0].n + 1 : 1, label, mode: team != null ? "Make " + E.tn(getState(), team) + " win" : MODES[mode], s, S: getState() }, ...l].slice(0, 12));
  };
  const run = (upTo, label, fresh = false) => {
    if (!g) { toast("Do the quick setup first."); return; }
    if (fresh && hasScores && !ok("All scores will be replaced.")) return;
    let n = 0;
    update(st => { if (fresh) clearScores(st); n = simulate(st, { upTo, mode, team }); });
    if (!n) { toast(allPlayed(getState()) ? "Everything is already played. Use Rerun." : "Nothing to play yet."); return; }
    toast(`${n} ${n === 1 ? "tie" : "ties"} played`);
    record(label);
  };
  const setup = () => {
    if ((hasScores || S.locked) && !confirm("Quick setup replaces teams, groups and scores. Continue?")) return;
    if (!ok("Teams, groups and scores will be replaced.")) return;
    let err = "";
    update(st => { try { quickSetup(st); } catch (e) { err = e.message; } });
    if (err) toast(err); else { setTeam(null); toast("Teams and groups drawn"); }
  };

  return (
    <>
      {IS_PROD
        ? <div className="banner warn"><AlertTriangle size={18} /><div>You are on the <b>live</b> site. These tools change the real tournament. Use the preview link for testing.</div></div>
        : <div className="banner"><FlaskConical size={18} /><div>Test tools. Only on preview and local builds; saved separately from the live tournament.</div></div>}

      <div className="section"><h2>1 · Start</h2></div>
      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>Draws balanced teams and the groups in one tap, with no ceremony. Uses the first 16 men and 8 women if the player numbers are off.</p>
        <button className="btn primary block" onClick={setup}><Wand2 size={16} />Quick setup</button>
      </div>

      <div className="section"><h2>2 · Who wins</h2></div>
      <div className="card">
        <div className="fseg" role="radiogroup" aria-label="Results" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          {Object.entries(MODES).map(([k, n]) => (
            <button key={k} role="radio" aria-checked={mode === k && team == null} className={mode === k && team == null ? "on" : ""} onClick={() => { setMode(k); setTeam(null); }}><b>{n}</b></button>
          ))}
        </div>
        <p className="hint">{team != null ? `${E.tn(S, team)} wins every tie it plays. Other ties follow "${MODES[mode]}".` : {
          random: "Every tie is a coin toss.",
          favourites: "The stronger team (sum of levels) wins 8 times in 10.",
          upsets: "The weaker team wins 8 times in 10.",
          tight: "Every tie ends 2–1 with close games, to test the tiebreakers."
        }[mode]}</p>
        <label className="lbl">Make one team win everything</label>
        <div className={`fteams ${team != null ? "picked" : ""}`} role="radiogroup" aria-label="Team to win">
          <button role="radio" aria-checked={team == null} className={`all ${team == null ? "on" : ""}`} onClick={() => setTeam(null)}>None</button>
          {S.teams.map((_, t) => (
            <button key={t} role="radio" aria-checked={team === t} aria-label={E.tn(S, t)} title={E.tn(S, t)} className={team === t ? "on" : ""} onClick={() => setTeam(team === t ? null : t)}>
              <Badge S={S} t={t} size="sm" />
            </button>
          ))}
        </div>
      </div>

      <div className="section"><h2>3 · Play</h2><span>{g ? (allPlayed(S) ? "All played" : `${E.allMatches(S).filter(m => E.res(S, m).done).length}/20 ties played`) : "Not set up"}</span></div>
      <div className="card">
        <div className="btns" style={{ marginTop: 0 }}>
          <button className="btn" onClick={() => run("some", "A few ties")}><StepForward size={16} />Play a few ties</button>
          <button className="btn" onClick={() => run("groups", "Group stage")}><Flag size={16} />Group stage</button>
          <button className="btn" onClick={() => run("all", "Everything")}><Trophy size={16} />To the end</button>
        </div>
        <div className="btns">
          <button className="btn primary block" onClick={() => run("all", "Rerun", true)}><Shuffle size={16} />Rerun whole tournament</button>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>Scores you entered by hand are kept; only unplayed ties are filled. Rerun clears every score first, so each tap gives a new tournament with the same teams and groups.</p>
      </div>

      <div className="section"><h2>Scenarios</h2></div>
      <div className="card">
        <div className="btns" style={{ marginTop: 0 }}>
          <button className="btn" onClick={() => { if (!g) return toast("Do the quick setup first."); if (!ok("Group A scores will be replaced.")) return; update(st => threeWayTie(st, "A")); toast("Group A: seats 1, 2 and 3 beat each other in a circle"); }}><RotateCcw size={16} />3-way tie in Group A</button>
          <button className="btn danger" onClick={() => { if (hasScores && confirm("Clear every score?") && ok("Every score will be cleared.")) { update(clearScores); toast("Scores cleared"); } }}><Eraser size={16} />Clear scores</button>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>After the 3-way tie, check Tables: the three teams are level on everything, so they are ordered by team number.</p>
      </div>

      {log.length > 0 && (
        <>
          <div className="section"><h2>Run log</h2><span>This session</span></div>
          {log.map(e => <RunCard key={e.n} e={e} />)}
        </>
      )}
    </>
  );
}

function RunCard({ e }) {
  const { s, S } = e, sd = s.seeds;
  const team = t => <span className="rl-team" key={t}><Badge S={S} t={t} size="sm" />{E.tn(S, t)}</span>;
  return (
    <div className="card runlog">
      <div className="rl-head"><b>Run {e.n}</b><span>{e.label} · {e.mode}</span></div>
      <div className="rl-row"><small>Group A</small><div>{s.A.map((t, i) => <span key={t} className={i < 2 ? "q" : ""}>{i + 1}. {E.abbr(S, t)}</span>)}</div></div>
      <div className="rl-row"><small>Group B</small><div>{s.B.map((t, i) => <span key={t} className={i < 2 ? "q" : ""}>{i + 1}. {E.abbr(S, t)}</span>)}</div></div>
      {sd && <div className="rl-row"><small>{E.BR.Cup}</small><div>{sd.Cup.map((t, i) => <span key={t}>{i + 1}. {E.abbr(S, t)}</span>)}</div></div>}
      {sd && <div className="rl-row"><small>{E.BR.Plate}</small><div>{sd.Plate.map((t, i) => <span key={t}>{i + 1}. {E.abbr(S, t)}</span>)}</div></div>}
      {(s.champ.Cup != null || s.champ.Plate != null) && (
        <div className="rl-champs">
          {s.champ.Cup != null && <div><Trophy size={14} />{team(s.champ.Cup)}</div>}
          {s.champ.Plate != null && <div><small>{E.BR.Plate}</small>{team(s.champ.Plate)}</div>}
        </div>
      )}
    </div>
  );
}
