import { useState } from "react";
import { FlaskConical, Wand2, StepForward, Flag, Trophy, RotateCcw, Eraser, Shuffle, AlertTriangle } from "lucide-react";
import * as E from "../lib/engine.js";
import { MODES, simulate, quickSetup, threeWayTie, clearScores, clearPlayoffs, summary, allPlayed } from "../lib/simulate.js";
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
  const [cl, setCl] = useState(null);   // chosen Champions League winner
  const [fpl, setFpl] = useState(null); // chosen Premier League winner
  const [log, setLog] = useState([]);
  const g = E.groups(S);
  const hasScores = Object.keys(S.scores).length > 0;
  const pre = g ? E.prelims(S) : [], po = g ? E.playoffs(S) : [];
  const gDone = pre.filter(m => E.res(S, m).done).length, poDone = po.filter(m => E.res(S, m).done).length;
  // The playoff round that is ready to play now, by its matches' names.
  const ready = po.filter(m => E.ready(m) && !E.res(S, m).done).map(m => m.label);
  const nextRound = !ready.length ? "" : ready.includes("Qualifier 1") || ready.includes("Eliminator") ? "Qualifier 1 & Eliminators" : ready.includes("Qualifier 2") ? "Qualifier 2s" : "Finals";
  const ok = msg => !IS_PROD || confirm("This is the LIVE tournament. " + msg + "\n\nContinue?");

  const record = label => {
    const s = summary(getState());
    if (!s) return;
    const picks = [cl != null && E.BR.Cup + ": " + E.tn(getState(), cl), fpl != null && E.BR.Plate + ": " + E.tn(getState(), fpl)].filter(Boolean);
    setLog(l => [{ n: l.length ? l[0].n + 1 : 1, label, mode: [MODES[mode], ...picks].join(" · "), s, S: getState() }, ...l].slice(0, 12));
  };
  const run = (upTo, label, fresh = false) => {
    if (!g) { toast("Do the quick setup first."); return; }
    if (fresh && hasScores && !ok("All scores will be replaced.")) return;
    let n = 0;
    update(st => { if (fresh) clearScores(st); n = simulate(st, { upTo, mode, cl, fpl }); });
    if (!n) {
      const st = getState(), groupsDone = E.prelimsDone(st);
      toast(allPlayed(st) ? "Everything is already played. Use Rerun."
        : (upTo === "round" || upTo === "playoffs") && !groupsDone ? "Finish the group stage first."
        : (upTo === "groups" || upTo === "groups-some") && groupsDone ? "The group stage is already played."
        : "Nothing to play yet.");
      return;
    }
    // Scores already in place can stop a chosen team from winning: say so.
    const champ = summary(getState()).champ, missed = [[cl, champ.Cup, E.BR.Cup], [fpl, champ.Plate, E.BR.Plate]].filter(([t, w]) => t != null && w != null && w !== t);
    toast(missed.length ? missed.map(([t, , name]) => `${E.tn(getState(), t)} could not win the ${name}: earlier scores got in the way. Use Rerun.`).join("\n") : `${n} ${n === 1 ? "match" : "matches"} played`);
    record(label);
  };
  const setup = () => {
    if ((hasScores || S.locked) && !confirm("Quick setup replaces teams, groups and scores. Continue?")) return;
    if (!ok("Teams, groups and scores will be replaced.")) return;
    let err = "";
    update(st => { try { quickSetup(st); } catch (e) { err = e.message; } });
    if (err) toast(err); else { setCl(null); setFpl(null); toast("Teams and groups drawn"); }
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
            <button key={k} role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}><b>{n}</b></button>
          ))}
        </div>
        <p className="hint">{{
          random: "Every match is a coin toss.",
          favourites: "The stronger team (sum of levels) wins 8 times in 10.",
          upsets: "The weaker team wins 8 times in 10.",
          tight: "Every match ends 2–1 with close games, to test the tiebreakers."
        }[mode]}</p>
        {[[E.BR.Cup + " winner", cl, setCl, setFpl, fpl], [E.BR.Plate + " winner", fpl, setFpl, setCl, cl]].map(([label, v, set, setOther, other]) => (
          <div key={label}>
            <label className="lbl">{label}</label>
            <div className={`fteams ${v != null ? "picked" : ""}`} role="radiogroup" aria-label={label}>
              <button role="radio" aria-checked={v == null} className={`all ${v == null ? "on" : ""}`} onClick={() => set(null)}>Any</button>
              {S.teams.map((_, t) => (
                <button key={t} role="radio" aria-checked={v === t} aria-label={E.tn(S, t)} title={E.tn(S, t)} className={v === t ? "on" : ""}
                  onClick={() => { set(v === t ? null : t); if (other === t) setOther(null); }}>
                  <Badge S={S} t={t} size="sm" />
                </button>
              ))}
            </div>
          </div>
        ))}
        {(cl != null || fpl != null) && <p className="hint" style={{ marginBottom: 0 }}>{[cl != null && `${E.tn(S, cl)} wins every match and the ${E.BR.Cup}.`, fpl != null && `${E.tn(S, fpl)} loses its group matches, so it finishes 3rd or 4th, then wins the ${E.BR.Plate}.`].filter(Boolean).join(" ")} Other matches follow "{MODES[mode]}". Use Rerun if some scores are already in.</p>}
      </div>

      <div className="section"><h2>3 · Group stage</h2><span>{g ? `${gDone}/${pre.length} matches played` : "Not set up"}</span></div>
      <div className="card">
        <div className="btns" style={{ marginTop: 0 }}>
          <button className="btn" onClick={() => run("groups-some", "A few group matches")}><StepForward size={16} />Play a few group matches</button>
          <button className="btn" onClick={() => run("groups", "Group stage")}><Flag size={16} />Play the whole group stage</button>
        </div>
        <div className="btns">
          <button className="btn danger" onClick={() => { if (hasScores && confirm("Clear every score, group stage and playoffs?") && ok("Every score will be cleared.")) { update(clearScores); toast("Scores cleared"); } }}><Eraser size={16} />Clear all scores</button>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>A few = one turn of the {E.courtCount(S)} courts. The playoffs open once all {pre.length} group matches are played.</p>
      </div>

      <div className="section"><h2>4 · Playoffs</h2><span>{!g ? "Not set up" : E.prelimsDone(S) ? `${poDone}/${po.length} matches played` : "After the group stage"}</span></div>
      <div className="card">
        <div className="btns" style={{ marginTop: 0 }}>
          <button className="btn" onClick={() => run("round", nextRound || "Playoff round")} disabled={!nextRound}><StepForward size={16} />{nextRound ? "Play " + nextRound : E.prelimsDone(S) ? "Playoffs finished" : "Play the next round"}</button>
          <button className="btn" onClick={() => run("playoffs", "Playoffs")}><Trophy size={16} />Play all playoffs</button>
        </div>
        <div className="btns">
          <button className="btn danger" onClick={() => { if (poDone && confirm("Clear the playoff scores? The group stage stays.") && ok("Playoff scores will be cleared.")) { update(clearPlayoffs); toast("Playoff scores cleared"); } }} disabled={!poDone}><Eraser size={16} />Clear playoffs only</button>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>Both playoffs go round by round: Qualifier 1 and Eliminator, then Qualifier 2, then the Final. Clear playoffs only to replay them from the same group results.</p>
      </div>

      <div className="section"><h2>5 · Whole tournament</h2><span>{g ? (allPlayed(S) ? "All played" : `${gDone + poDone}/${pre.length + po.length} matches played`) : "Not set up"}</span></div>
      <div className="card">
        <div className="btns" style={{ marginTop: 0 }}>
          <button className="btn primary" onClick={() => run("all", "Rerun", true)}><Shuffle size={16} />Rerun whole tournament</button>
          <button className="btn" onClick={() => run("all", "Everything")}><Trophy size={16} />Play to the end</button>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>Scores you entered by hand are kept; only unplayed matches are filled. Rerun clears every score first, so each tap gives a new tournament with the same teams and groups.</p>
      </div>

      <div className="section"><h2>Scenarios</h2></div>
      <div className="card">
        <div className="btns" style={{ marginTop: 0 }}>
          <button className="btn" onClick={() => { if (!g) return toast("Do the quick setup first."); if (!ok("Group A scores will be replaced.")) return; update(st => threeWayTie(st, "A")); toast("Group A: seats 1, 2 and 3 beat each other in a circle"); }}><RotateCcw size={16} />3 teams level in Group A</button>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>After this, check Standings: the three teams are level on everything, so they are ordered by team number.</p>
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
