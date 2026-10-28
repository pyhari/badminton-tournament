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
    id: m.id, win, lose,
    stage: m.stage + (m.label ? " · " + m.label : ""),
    winner: tn(S, win), winnerPlayers: tp(S, win),
    loser: tn(S, lose), loserPlayers: tp(S, lose),
    result: `${Math.max(...r.gw)}–${Math.min(...r.gw)}`,
    games,
    upset: gap >= UPSET_GAP,
    strengthGap: gap,
    cameFromBehind: r.gs[0].w !== w,
    pointDiff: w === 0 ? r.pt[0] - r.pt[1] : r.pt[1] - r.pt[0],
    closestGame: games.reduce((a, b) => (b.margin < a.margin ? b : a)).game
  };
}

// Every finished match, groups first, then the playoffs in order.
function finished(S) {
  return prelims(S).concat(playoffs(S)).filter(m => m.a != null && m.b != null).map(m => tieFacts(S, m)).filter(Boolean);
}

// A short tag shown before a match's recap, from the facts.
export function matchTag(f) {
  if (!f) return null;
  if (f.upset) return "Upset";
  if (f.cameFromBehind) return "Comeback";
  const x = f.games.filter(g => g.extraPoints).sort((a, b) => parseInt(b.score) - parseInt(a.score))[0];
  if (x) return x.score + " thriller";
  if (f.result === "3–0") return "Clean sweep";
  return null;
}

// Up to 3 matches worth a card, each a different match: the biggest upset, the
// tightest game, the latest comeback, then the most one-sided sweep.
export function highlights(S) {
  if (!groups(S)) return [];
  const ties = finished(S), out = [], used = new Set();
  const add = (kind, t, extra = {}) => {
    if (t && !used.has(t.id) && out.length < 3) { used.add(t.id); out.push({ key: kind + ":" + t.id, kind, match: t, ...extra }); }
  };
  add("upset", ties.filter(t => t.upset).sort((a, b) => b.strengthGap - a.strengthGap)[0]);
  const close = ties.flatMap(t => t.games.map(g => ({ t, g }))).filter(x => x.g.extraPoints || x.g.margin <= 2)
    .sort((a, b) => a.g.margin - b.g.margin || parseInt(b.g.score) - parseInt(a.g.score))[0];
  if (close) add("thriller", close.t, { game: close.g });
  add("comeback", ties.filter(t => t.cameFromBehind).slice(-1)[0]);
  add("sweep", ties.filter(t => t.result === "3–0").sort((a, b) => b.pointDiff - a.pointDiff)[0]);
  return out;
}

// Each group's teams in table order with where they stand, for the "group race" strip.
export function groupRace(S) {
  if (!groups(S)) return [];
  return ["A", "B"].map(gk => ({ name: "Group " + gk, rows: groupStatus(S, gk) }));
}

// Playoff champions so far, as [{ name, t }].
export function champions(S) {
  const out = [];
  for (const br of ["Cup", "Plate"]) {
    const f = playoffs(S).find(m => m.br === br && m.label === "Final"), w = f && f.a != null && f.b != null ? winnerTeam(S, f) : null;
    if (w != null) out.push({ name: BR[br], t: w });
  }
  return out;
}

// Where each group team stands. "through": top 2 whatever happens. "out": cannot reach the top 2.
// Until the group is finished, judged on matches won only, so it says "through" or "out" only when that is certain.
function groupStatus(S, gk) {
  const rows = table(S, gk);
  const left = t => prelims(S).filter(m => m.stage === "Group " + gk && (m.a === t || m.b === t) && !res(S, m).done).length;
  // Once every group match is played, the table (with its tiebreaks) settles it.
  const settled = rows.every(x => !left(x.t));
  return rows.map((x, i) => {
    if (settled) return { pos: i + 1, t: x.t, team: tn(S, x.t), played: x.p, won: x.w, gamesWon: x.gw, pointDiff: x.pd, left: 0, status: i < 2 ? "through" : "out" };
    const best = x.w + left(x.t);
    const above = rows.filter(o => o.t !== x.t && o.w > best).length;
    const canCatch = rows.filter(o => o.t !== x.t && o.w + left(o.t) >= x.w).length;
    return {
      pos: i + 1, t: x.t, team: tn(S, x.t), played: x.p, won: x.w, gamesWon: x.gw, pointDiff: x.pd, left: left(x.t),
      status: canCatch <= 1 ? "through" : above >= 2 ? "out" : "in contention"
    };
  });
}

// The whole day so far: tables, every finished tie, the upsets and the closest games.
export function dayFacts(S) {
  if (!groups(S)) return null;
  const ties = finished(S);
  if (!ties.length) return null;
  const pre = prelims(S);
  const allGames = ties.flatMap(t => t.games.map(g => ({ ...g, stage: t.stage, tie: `${t.winner} v ${t.loser}` })));
  return {
    progress: `${ties.length} of ${pre.length + 8} matches played`,
    // Teams outside the top 2 are not out of the tournament: they play the FPL.
    groups: Object.fromEntries(["A", "B"].map(gk => ["Group " + gk, groupStatus(S, gk).map(({ t, ...x }) => ({ ...x,
      status: x.status === "through" ? `certain top 2: into the ${BR.Cup}` : x.status === "out" ? `certain 3rd or 4th: into the ${BR.Plate}` : "not settled yet" }))])),
    upsets: ties.filter(t => t.upset).map(t => `${t.winner} beat ${t.loser} ${t.result} (${t.stage})`),
    closestGames: allGames.sort((a, b) => a.margin - b.margin || b.score.localeCompare(a.score)).slice(0, 3)
      .map(g => `${g.winningPair} (${g.winner}) won ${g.game} ${g.score} in ${g.tie}, ${g.stage}`),
    playoffResults: ties.filter(t => !t.stage.startsWith("Group")).map(t => `${t.stage}: ${t.winner} beat ${t.loser} ${t.result}`),
    champions: champions(S).map(c => ({ bracket: c.name, team: tn(S, c.t), players: tp(S, c.t) }))
  };
}

// Changes whenever a result changes, so the server knows when to write again.
export function factsKey(S) {
  const f = dayFacts(S);
  return f ? JSON.stringify([f.progress, f.groups, f.playoffResults]) : "";
}
// One key per tie, so a corrected score gets a new recap.
export const tieKey = t => JSON.stringify([t.winner, t.loser, t.games.map(g => g.score + g.winner)]);
