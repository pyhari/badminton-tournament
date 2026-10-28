// Facts about the tournament so far, worked out from the scores, for the AI
// match recaps and "story so far" on the players' page. The AI only puts these
// facts into words, so everything it says comes from here.
import { GAME_LABELS, BR, groups, prelims, playoffs, res, table, tn, tp, pairOf, power, winnerTeam } from "./engine.js";

// A win by a team at least this much weaker (sum of player levels) counts as an upset.
const UPSET_GAP = 2;

// Everything about one finished tie that a recap may mention.
export function tieFacts(S, m) {
  const r = res(S, m);
  if (!r.done) return null;
  const w = r.winner, win = w === 0 ? m.a : m.b, lose = w === 0 ? m.b : m.a;
  const games = r.gs.map((g, i) => ({
    game: GAME_LABELS[i],
    winner: tn(S, g.w === 0 ? m.a : m.b),
    score: `${Math.max(g.a, g.b)}–${Math.min(g.a, g.b)}`,
    winningPair: pairOf(S, g.w === 0 ? m.a : m.b, i),
    losingPair: pairOf(S, g.w === 0 ? m.b : m.a, i),
    extraPoints: Math.max(g.a, g.b) > 15,
    margin: Math.abs(g.a - g.b)
  }));
  const gap = power(S, lose) - power(S, win);
  return {
    id: m.id,
    stage: m.stage + (m.label ? " · " + m.label : ""),
    winner: tn(S, win), winnerPlayers: tp(S, win),
    loser: tn(S, lose), loserPlayers: tp(S, lose),
    result: `${Math.max(...r.gw)}–${Math.min(...r.gw)}`,
    games,
    upset: gap >= UPSET_GAP,
    strengthGap: gap,
    cameFromBehind: r.gs[0].w !== w,
    closestGame: games.reduce((a, b) => (b.margin < a.margin ? b : a)).game
  };
}

// Where each group team stands. "through": top 2 whatever happens. "out": cannot reach the top 2.
// Judged on ties won only, so it says "through" or "out" only when that is certain.
function groupStatus(S, gk) {
  const rows = table(S, gk);
  const left = t => prelims(S).filter(m => m.stage === "Group " + gk && (m.a === t || m.b === t) && !res(S, m).done).length;
  return rows.map((x, i) => {
    const best = x.w + left(x.t);
    const above = rows.filter(o => o.t !== x.t && o.w > best).length;
    const canCatch = rows.filter(o => o.t !== x.t && o.w + left(o.t) >= x.w).length;
    return {
      pos: i + 1, team: tn(S, x.t), played: x.p, won: x.w, gamesWon: x.gw, pointDiff: x.pd, left: left(x.t),
      status: canCatch <= 1 ? "through" : above >= 2 ? "out" : "in contention"
    };
  });
}

// The whole day so far: tables, every finished tie, the upsets and the closest games.
export function dayFacts(S) {
  if (!groups(S)) return null;
  const ties = prelims(S).concat(playoffs(S)).filter(m => m.a != null && m.b != null).map(m => tieFacts(S, m)).filter(Boolean);
  if (!ties.length) return null;
  const pre = prelims(S);
  const allGames = ties.flatMap(t => t.games.map(g => ({ ...g, stage: t.stage, tie: `${t.winner} v ${t.loser}` })));
  const champions = {};
  for (const br of ["Cup", "Plate"]) {
    const f = playoffs(S).find(m => m.br === br && m.label === "Final"), w = f && f.a != null && f.b != null ? winnerTeam(S, f) : null;
    if (w != null) champions[BR[br]] = { team: tn(S, w), players: tp(S, w) };
  }
  return {
    progress: `${ties.length} of ${pre.length + 8} ties played`,
    groups: { "Group A": groupStatus(S, "A"), "Group B": groupStatus(S, "B") },
    upsets: ties.filter(t => t.upset).map(t => `${t.winner} beat ${t.loser} ${t.result} (${t.stage})`),
    closestGames: allGames.sort((a, b) => a.margin - b.margin || b.score.localeCompare(a.score)).slice(0, 3)
      .map(g => `${g.winningPair} (${g.winner}) won ${g.game} ${g.score} in ${g.tie}, ${g.stage}`),
    playoffResults: ties.filter(t => !t.stage.startsWith("Group")).map(t => `${t.stage}: ${t.winner} beat ${t.loser} ${t.result}`),
    champions
  };
}

// Changes whenever a result changes, so the server knows when to write again.
export function factsKey(S) {
  const f = dayFacts(S);
  return f ? JSON.stringify([f.progress, f.groups, f.playoffResults]) : "";
}
// One key per tie, so a corrected score gets a new recap.
export const tieKey = t => JSON.stringify([t.winner, t.loser, t.games.map(g => g.score + g.winner)]);
