// Test tools: fill in results so the whole tournament can be played through quickly.
import * as E from "./engine.js";

export const MODES = {
  random: "Random",
  favourites: "Favourites",
  upsets: "Upsets",
  tight: "Tight"
};

const chance = (rnd, p) => rnd(1000) < p * 1000;

// Which side wins a tie: 0 for team a, 1 for team b.
// cl: the team chosen to win the Champions League. It wins every match it plays.
// fpl: the team chosen to win the Premier League. It loses all its group matches, which always leaves it
// 3rd or 4th (no other team can also end on zero wins and still be above it in the top 2),
// then wins every Premier League match.
function pickWinner(S, m, mode, { cl, fpl }, rnd) {
  const has = t => t != null && (m.a === t || m.b === t), side = t => (m.a === t ? 0 : 1);
  if (has(cl) && m.br !== "Plate") return side(cl);
  if (has(fpl)) return m.br === "Plate" ? side(fpl) : 1 - side(fpl);
  const pa = E.power(S, m.a), pb = E.power(S, m.b);
  const strongA = pa > pb ? 0.8 : pa < pb ? 0.2 : 0.5;
  const pA = mode === "favourites" ? strongA : mode === "upsets" ? 1 - strongA : 0.5;
  return chance(rnd, pA) ? 0 : 1;
}

// A finished game score [winner, loser]: 15 to 0–13, or two clear after 14-all.
function gameScore(tight, rnd) {
  if (tight || chance(rnd, 0.15)) {
    if (chance(rnd, 0.5)) return [15, 13];
    const w = 16 + rnd(3);
    return [w, w - 2];
  }
  return [15, 3 + rnd(11)];
}

// Writes three game scores so that `winner` takes the tie 2–0 (plus a dead rubber) or 2–1.
export function playTie(S, m, winner, { tight = false, rnd = E.cryptoRnd } = {}) {
  const lost = tight || chance(rnd, 0.4) ? rnd(3) : -1; // the one game the tie winner drops
  for (let g = 0; g < 3; g++) {
    const [w, l] = gameScore(tight, rnd);
    const side = g === lost ? 1 - winner : winner;
    E.setScore(S, m, g, side, w);
    E.setScore(S, m, g, 1 - side, l);
  }
}

// Plays unfinished ties whose teams are known. Playoff ties become ready as earlier
// results come in, so it keeps going until nothing is left to play.
// upTo: "some" (one turn of the courts, any stage), "groups-some" (one turn of the courts,
// group matches only), "groups" (the whole group stage), "round" (the playoff matches ready
// now: Q1 and Eliminators, then Q2s, then Finals), "playoffs" or "all".
// team: same as cl (the team that wins everything).
export function simulate(S, { upTo = "all", mode = "random", team = null, cl = team, fpl = null, rnd = E.cryptoRnd } = {}) {
  if (!E.groups(S)) return 0;
  let played = 0;
  for (;;) {
    let todo = E.allMatches(S).filter(m => E.ready(m) && !E.res(S, m).done);
    if (upTo === "groups" || upTo === "groups-some") todo = todo.filter(m => !m.br);
    if (upTo === "round" || upTo === "playoffs") todo = todo.filter(m => m.br);
    if (upTo === "some" || upTo === "groups-some") todo = E.shuffle(todo, rnd).slice(0, Math.max(0, E.courtCount(S) - played));
    if (!todo.length) break;
    for (const m of todo) {
      playTie(S, m, pickWinner(S, m, mode, { cl, fpl: fpl === cl ? null : fpl }, rnd), { tight: mode === "tight", rnd });
      played++;
    }
    if (upTo === "some" || upTo === "groups-some" || upTo === "round") break;
  }
  return played;
}
export const allPlayed = S => !!E.groups(S) && E.allMatches(S).every(m => E.res(S, m).done);

// Group seats 1 > 2 > 3 > 1 in a circle with identical scores, and all three beat seat 4,
// so the table has to fall back to its last tiebreaker.
export function threeWayTie(S, gk = "A") {
  const g = E.groups(S)[gk], [a, b, c] = g;
  const beats = (x, y) => (x === a && y === b) || (x === b && y === c) || (x === c && y === a) || (y === g[3] && x !== g[3]);
  for (const m of E.prelims(S).filter(x => x.stage === "Group " + gk)) {
    const w = beats(m.a, m.b) ? 0 : 1;
    [[15, 10], [15, 10], [10, 15]].forEach(([x, y], i) => { E.setScore(S, m, i, w, x); E.setScore(S, m, i, 1 - w, y); });
  }
}

export function clearScores(S) { S.scores = {}; S.who = {}; S.court = {}; S.ok = {}; }
// Clears the playoff scores only, keeping the group stage.
export function clearPlayoffs(S) {
  for (const m of E.playoffs(S)) {
    delete S.scores[m.id]; delete S.who[m.id]; delete S.court[m.id];
    Object.keys(S.ok).filter(k => k.startsWith(m.id + ".")).forEach(k => delete S.ok[k]);
  }
}

// One tap from any state to drawn groups: picks 16 men and 8 women if the numbers are off,
// draws balanced teams, locks them and draws the groups. Scores are cleared.
export function quickSetup(S, rnd = E.cryptoRnd) {
  // Teams are redrawn anyway, so placeholder names can give way to the club's real list.
  if (E.isOldList(S)) S.players = E.defaults().players;
  if (E.poolIssues(S).length) {
    let men = 0, women = 0;
    S.players.forEach(p => { p.on = p.g === "M" ? men++ < 2 * E.NT : women++ < E.NT; });
    if (E.poolIssues(S).length) throw new Error("Not enough players: add more men or women in Players.");
  }
  E.drawTeams(S, rnd);
  S.locked = true;
  E.clearDraw(S);
  while (S.picks.length < E.NT) E.pickNext(S, rnd);
}

// What happened, for the run log.
export function summary(S) {
  const g = E.groups(S);
  if (!g) return null;
  const top = gk => E.table(S, gk).map(x => x.t);
  const out = { A: top("A"), B: top("B"), seeds: E.seeds(S), champ: {} };
  for (const m of E.playoffs(S).filter(x => x.label === "Final")) out.champ[m.br] = E.winnerTeam(S, m);
  return out;
}
