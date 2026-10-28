// Tournament rules: teams, draws, fixtures, results, tables and playoffs.
// Every function takes the tournament state S and has no UI or storage code.

export const MEN = ["Arjun", "Chandru", "Dinesh R", "Shankar", "Harish", "Prabhu", "Justin", "Manoj", "Prem", "Hari", "Dinesh B", "Sai", "Sashank", "Kartik", "Yuvaraj", "Praveen"];
export const WOMEN = ["Meenakshi", "Nandhini", "Hema", "Radha", "Nivedita", "Shobi", "Vidhu", "Pradhu"];
// The placeholder list the app started with. A saved list still exactly like it (never edited)
// is swapped for the club's real names above.
const OLD_LIST = "M:Arjun,Bharani,Chandru,Dinesh,Harikumar,Praveen,Shankar,Harish,Prabhu,Justin,Manoj,Prem,Rupesh,Sai,Shashank,Karthik,Yuvaraj,Karan|F:Bharani,Meenakshi,Nandhini,Hema,Radha,Vidhu,Pradhu,Nandini";
const listSig = ps => ["M", "F"].map(g => g + ":" + ps.filter(p => p.g === g).map(p => p.name).join(",")).join("|");
export const isOldList = S => listSig(S.players) === OLD_LIST && S.players.every(p => p.lvl === 3);
export const BR = { Cup: "Champions League", Plate: "FPL" };
export const GAME_LABELS = ["Men's doubles", "Mixed doubles 1", "Mixed doubles 2"];
export const NT = 8, NG = 2; // teams, groups
export const SLOT = { m1: "Man 1", m2: "Man 2", w: "Woman" };
export const SLOTS = ["m1", "m2", "w"];
export const slotG = f => f === "w" ? "F" : "M";
export const STAGES = ["Group A", "Group B", "Champions League", "FPL"];

export const player = (name, g) => ({ name, g, lvl: 3, on: true });

export const defaults = () => ({
  settings: { courts: 4 },
  players: MEN.map(n => player(n, "M")).concat(WOMEN.map(n => player(n, "F"))),
  teams: Array.from({ length: NT }, (_, i) => ({ name: "Team " + (i + 1), m1: "", m2: "", w: "" })),
  locked: false, // teams are final; the group draw can start
  pots: [],      // group draw seeding pots, fixed when the draw starts
  picks: [],     // group draw order; pick k goes to group k % NG, seat k / NG
  drawn: [],     // final seats: Group A seats 1-4, then Group B seats 1-4
  scores: {},
  who: {},
  court: {}      // tie id -> court it was called to; ties are played on any free court in any order
});

// Fill in fields that older saved states do not have.
export function fix(o) {
  const s = Object.assign(defaults(), o);
  const full = s.teams.every(x => x.m1 && x.m2 && x.w);
  if (!o.players) {
    const named = new Set();
    s.teams.forEach(x => SLOTS.forEach(f => x[f] && named.add(slotG(f) + x[f])));
    const extra = [...named].filter(k => !s.players.some(p => p.g + p.name === k)).map(k => player(k.slice(1), k[0]));
    s.players = s.players.concat(extra);
    if (full) s.players.forEach(p => p.on = named.has(p.g + p.name));
  }
  if (o.locked === undefined) s.locked = full || s.drawn.length > 0;
  // Never-edited placeholder names and no team made yet: use the club's real list.
  if (isOldList(s) && !s.teams.some(x => x.m1 || x.m2 || x.w)) s.players = defaults().players;
  return s;
}

/* ---------- teams ---------- */
export const tn = (S, t) => t == null ? "To be decided" : (S.teams[t].name || "Team " + (t + 1));
// A team's players, woman first, as [{ name, g }].
export const roster = (S, t) => {
  if (t == null) return [];
  const x = S.teams[t];
  return [{ name: x.w, g: "F" }, { name: x.m1, g: "M" }, { name: x.m2, g: "M" }].filter(p => p.name);
};
// The same as text: "Nandhini, Arjun & Prem".
export const tp = (S, t) => {
  const n = roster(S, t).map(p => p.name);
  return n.length > 1 ? n.slice(0, -1).join(", ") + " & " + n[n.length - 1] : n.join("");
};
// Short code for a team badge: initials of a multi-word name, else the first three letters.
export function abbr(S, t) {
  if (t == null) return "TBD";
  const words = tn(S, t).trim().split(/\s+/).filter(Boolean);
  const s = words.length > 1 ? words.map(w => w[0]).join("") : words[0] || "";
  return s.slice(0, 3).toUpperCase();
}
// The pair playing game i for team t (woman first in the mixed games), as [{ name, g }].
export function pairPlayers(S, t, i) {
  const x = S.teams[t];
  const a = { name: x.m1 || "Man 1", g: "M" }, b = { name: x.m2 || "Man 2", g: "M" }, w = { name: x.w || "Woman", g: "F" };
  return i === 0 ? [a, b] : i === 1 ? [w, a] : [w, b];
}
export const pairOf = (S, t, i) => pairPlayers(S, t, i).map(p => p.name).join(" & ");
export const findP = (S, name, g) => S.players.find(p => p.g === g && p.name === name);
export const lvl = (S, name, g) => (findP(S, name, g) || { lvl: 0 }).lvl;
export const power = (S, t) => { const x = S.teams[t]; return lvl(S, x.m1, "M") + lvl(S, x.m2, "M") + lvl(S, x.w, "F"); };
export const teamOf = (S, p) => S.teams.findIndex(x => SLOTS.some(f => slotG(f) === p.g && x[f] === p.name));

// Problems that stop the team draw: the number of players marked as playing.
export function poolIssues(S) {
  const out = [];
  [["M", "men", 2 * NT], ["F", "women", NT]].forEach(([g, word, need]) => {
    const n = S.players.filter(p => p.on && p.g === g).length;
    if (n !== need) out.push(`${n} ${word} are playing and ${need} are needed. ` + (n > need ? `Untick ${n - need}.` : `Add or tick ${need - n}.`));
  });
  return out;
}
// Problems that stop the teams from being locked.
export function teamIssues(S) {
  const out = [], seen = {};
  S.teams.forEach((x, t) => SLOTS.forEach(f => {
    const n = x[f], g = slotG(f), p = findP(S, n, g);
    if (!n) { out.push(`${tn(S, t)}: ${SLOT[f]} is empty.`); return; }
    if (!p) out.push(`${n} (${tn(S, t)}) is not in the player list.`);
    else if (!p.on) out.push(`${n} (${tn(S, t)}) is not marked as playing.`);
    if (seen[g + n] != null) out.push(`${n} is in both ${tn(S, seen[g + n])} and ${tn(S, t)}.`);
    else seen[g + n] = t;
  }));
  return out;
}
// Renames a player and the team slot that holds them. Returns an error message or "".
export function renamePlayer(S, i, name) {
  const p = S.players[i];
  name = name.trim();
  if (!p || name === p.name) return "";
  if (!name) return "A player needs a name.";
  if (S.players.some(q => q !== p && q.g === p.g && q.name.toLowerCase() === name.toLowerCase())) return name + " is already in the list.";
  S.teams.forEach(x => SLOTS.forEach(f => { if (slotG(f) === p.g && x[f] === p.name) x[f] = name; }));
  p.name = name;
  return "";
}

/* ---------- draws ---------- */
export const cryptoRnd = n => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; } catch (e) { return Math.floor(Math.random() * n); } };
export const shuffle = (a, rnd = cryptoRnd) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Strongest first; equal levels in random order.
const byLevel = (ps, rnd) => shuffle(ps, rnd).sort((a, b) => b.lvl - a.lvl);

// Pot 1 is the stronger half of the men and gives each team its Man 1; Pot 2 gives Man 2.
// Many random draws are tried, each improved by swapping players inside a pot,
// and the one with the most even team strengths is kept.
// together: pairs of players who must be in the same team, as [["M:Arjun", "F:Hema"], ...]
// (see pairIssue). Two men paired are put in different pots, so one can be Man 1 and the other Man 2.
// apart: pairs of players who must be in different teams, in the same form (see apartIssue).
export function balancedTeams(S, rnd = cryptoRnd, together = [], apart = []) {
  const on = S.players.filter(p => p.on), key = p => p.g + ":" + p.name;
  const byKey = Object.fromEntries(on.map(p => [key(p), p]));
  const pairs = together.filter(([x, y]) => byKey[x] && byKey[y]).slice(0, NT);
  const partner = new Map(pairs.flatMap(([x, y]) => [[byKey[x], byKey[y]], [byKey[y], byKey[x]]]));
  const men = byLevel(on.filter(p => p.g === "M"), rnd);
  const pots = [men.slice(0, NT), men.slice(NT), on.filter(p => p.g === "F")];
  // Two paired men in the same pot: the weaker one (or the stronger, from Pot 2) swaps
  // pots with the nearest-level man who has no partner.
  for (const [x, y] of pairs) {
    const a = byKey[x], b = byKey[y];
    if (a.g !== "M" || b.g !== "M") continue;
    const k = pots[0].includes(a) && pots[0].includes(b) ? 0 : pots[1].includes(a) && pots[1].includes(b) ? 1 : -1;
    if (k < 0) continue;
    const mover = k === 0 ? (a.lvl <= b.lvl ? a : b) : (a.lvl >= b.lvl ? a : b);
    const other = pots[1 - k].filter(p => !partner.has(p)).sort((p, q) => Math.abs(p.lvl - mover.lvl) - Math.abs(q.lvl - mover.lvl))[0];
    if (!other) continue;
    pots[k][pots[k].indexOf(mover)] = other; pots[1 - k][pots[1 - k].indexOf(other)] = mover;
  }
  const colOf = p => pots.findIndex(c => c.includes(p));
  const split = apart.filter(([x, y]) => byKey[x] && byKey[y]).map(([x, y]) => [byKey[x], byKey[y]].map(p => [colOf(p), p]));
  // One random draw: each pair gets its own team, then everyone else fills the free places.
  const deal = () => {
    const cols = pots.map(() => Array(NT).fill(null)), teams = shuffle([...Array(NT).keys()], rnd);
    pairs.forEach(([x, y], i) => { [byKey[x], byKey[y]].forEach(p => { cols[colOf(p)][teams[i]] = p; }); });
    pots.forEach((pot, c) => {
      const rest = shuffle(pot.filter(p => !partner.has(p)), rnd);
      cols[c] = cols[c].map(p => p || rest.pop());
    });
    return cols;
  };
  // Swapping teams i and j in one pot also swaps the partners, so pairs stay together.
  const linked = (cols, c, i, j) => {
    const set = new Set([c]);
    for (const k of set) for (const p of [cols[k][i], cols[k][j]]) if (partner.has(p)) set.add(colOf(partner.get(p)));
    return [...set];
  };
  const swap = (cols, cs, i, j) => cs.forEach(c => { [cols[c][i], cols[c][j]] = [cols[c][j], cols[c][i]]; });
  let best = null, bestCost = Infinity;
  for (let k = 0; k < 60; k++) {
    const cols = deal(); // cols[pot][team]
    const cost = () => {
      const s = Array.from({ length: NT }, (_, t) => cols[0][t].lvl + cols[1][t].lvl + cols[2][t].lvl);
      // Two players kept apart but in the same team outweighs any difference in strength.
      const clash = split.filter(([[c1, p1], [c2, p2]]) => cols[c1].indexOf(p1) === cols[c2].indexOf(p2)).length;
      return clash * 1e9 + (Math.max(...s) - Math.min(...s)) * 1e6 + s.reduce((a, v) => a + v * v, 0);
    };
    let c = cost(), better = true;
    while (better) {
      better = false;
      for (let col = 0; col < 3; col++) for (let i = 0; i < NT; i++) for (let j = i + 1; j < NT; j++) {
        const cs = linked(cols, col, i, j);
        swap(cols, cs, i, j);
        const c2 = cost();
        if (c2 < c) { c = c2; better = true; } else swap(cols, cs, i, j);
      }
    }
    if (c < bestCost) { best = cols; bestCost = c; }
  }
  return best;
}
// Why two players cannot be kept together (null if they can).
export function pairIssue(together, x, y, apart = []) {
  if (x === y) return "Pick two different players.";
  if (x[0] === "F" && y[0] === "F") return "Each team has one woman, so two women cannot be together.";
  if (together.some(p => p.includes(x) || p.includes(y))) return "A player can be in one pair only.";
  if (apart.some(p => p.includes(x) && p.includes(y))) return "These two are set to be kept apart. Remove that first.";
  if (together.length >= NT) return `At most ${NT} pairs, one per team.`;
  return null;
}
// Why two players cannot be kept apart (null if they can).
export function apartIssue(together, apart, x, y) {
  if (x === y) return "Pick two different players.";
  if (x[0] === "F" && y[0] === "F") return "Two women are never in the same team anyway.";
  const same = p => p.includes(x) && p.includes(y);
  if (apart.some(same)) return "These two are already kept apart.";
  if (together.some(same)) return "These two are set to be kept together. Remove that pair first.";
  return null;
}
export function drawTeams(S, rnd = cryptoRnd, together = [], apart = []) {
  const cols = balancedTeams(S, rnd, together, apart);
  S.teams.forEach((x, t) => { x.m1 = cols[0][t].name; x.m2 = cols[1][t].name; x.w = cols[2][t].name; });
}
export function swapSlots(S, a, b) {
  const x = S.teams[a.t], y = S.teams[b.t];
  [x[a.f], y[b.f]] = [y[b.f], x[a.f]];
}
// Puts player i into a team slot; the player who leaves is marked as not playing.
export function subIn(S, slot, i) {
  const p = S.players[i], out = findP(S, S.teams[slot.t][slot.f], p.g);
  if (out) out.on = false;
  S.teams[slot.t][slot.f] = p.name; p.on = true;
}

// Teams are ranked by strength into pots of NG. Each pot sends one team to each group,
// so the strongest teams start in different groups.
export function makePots(S, rnd = cryptoRnd) {
  const ranked = shuffle([...Array(NT).keys()], rnd).sort((a, b) => power(S, b) - power(S, a));
  const pots = [];
  for (let i = 0; i < NT; i += NG) pots.push(ranked.slice(i, i + NG));
  return pots;
}
export const potLeft = S => S.pots[Math.floor(S.picks.length / NG)].filter(t => !S.picks.includes(t));
export const seatOf = k => ({ g: "AB"[k % NG], seat: Math.floor(k / NG) });
export function addPick(S, t) {
  S.picks.push(t);
  if (S.picks.length === NT) {
    const d = [];
    S.picks.forEach((x, k) => d[(k % NG) * (NT / NG) + Math.floor(k / NG)] = x);
    S.drawn = d;
  }
}
export function pickNext(S, rnd = cryptoRnd) {
  if (!S.pots.length) S.pots = makePots(S, rnd);
  const rem = potLeft(S);
  const t = rem[rnd(rem.length)];
  addPick(S, t);
  return t;
}
export function clearDraw(S) {
  S.drawn = []; S.picks = []; S.pots = []; S.scores = {}; S.who = {}; S.court = {};
}

/* ---------- fixtures ---------- */
export function groups(S) {
  if (S.drawn.length < NT) return null;
  return { A: S.drawn.slice(0, 4), B: S.drawn.slice(4, 8) };
}
const PR = [[[0, 3], [1, 2]], [[0, 2], [3, 1]], [[0, 1], [2, 3]]];
export function prelims(S) {
  const g = groups(S); if (!g) return [];
  const out = [];
  // Listed so each team's three ties are spread out; any order can be played.
  for (let r = 0; r < 3; r++) {
    for (const gk of ["A", "B"]) {
      for (const [x, y] of PR[r]) {
        out.push({ id: gk + (r + 1) + "-" + (x + 1) + "v" + (y + 1), stage: "Group " + gk, label: "", a: g[gk][x], b: g[gk][y] });
      }
    }
  }
  return out;
}

// Scores belong to the two teams they were entered for. If a corrected
// earlier result puts different teams in a playoff match, its old scores are ignored.
export function scoresOf(S, m) {
  const w = S.who && S.who[m.id];
  if (w && (w[0] !== m.a || w[1] !== m.b)) return [];
  return S.scores[m.id] || [];
}
export function setScore(S, m, g, side, value) {
  let arr = scoresOf(S, m);
  if (arr !== S.scores[m.id] || !arr.length) arr = S.scores[m.id] = [["", ""], ["", ""], ["", ""]];
  S.who[m.id] = [m.a, m.b];
  arr[g][side] = value === "" || value == null ? "" : +value;
}
function game(S, m, i) {
  const s = scoresOf(S, m)[i];
  if (!s) return null;
  const a = s[0], b = s[1];
  if (a === "" || b === "" || a == null || b == null || +a === +b) return null;
  return { a: +a, b: +b, w: +a > +b ? 0 : 1 };
}
// A finished game to 15 with no cap: 15 to 13 or less, or won by exactly 2 after 14-all.
export function validGame(g) {
  const hi = Math.max(g.a, g.b), lo = Math.min(g.a, g.b);
  return hi === 15 ? lo <= 13 : hi > 15 && hi - lo === 2;
}
export function res(S, m) {
  const gs = [0, 1, 2].map(i => game(S, m, i));
  const gw = [0, 0], pt = [0, 0];
  gs.forEach(g => { if (g) { gw[g.w]++; pt[0] += g.a; pt[1] += g.b; } });
  const done = gs.every(Boolean);
  const bad = gs.map((g, i) => g && !validGame(g) ? i : -1).filter(i => i >= 0);
  return { gs, done, gw, pt, bad, winner: done ? (gw[0] > gw[1] ? 0 : 1) : null, played: gs.filter(Boolean).length };
}
export function winnerTeam(S, m) { if (m.a == null || m.b == null) return null; const r = res(S, m); return r.done ? (r.winner === 0 ? m.a : m.b) : null; }
export function loserTeam(S, m) { if (m.a == null || m.b == null) return null; const r = res(S, m); return r.done ? (r.winner === 0 ? m.b : m.a) : null; }

function h2h(S, x, y) {
  const m = prelims(S).find(m => (m.a === x && m.b === y) || (m.a === y && m.b === x));
  if (!m) return 0;
  const w = winnerTeam(S, m);
  return w === x ? -1 : w === y ? 1 : 0;
}
export function table(S, gk) {
  const g = groups(S)[gk], st = {};
  g.forEach(t => st[t] = { t, p: 0, w: 0, l: 0, gw: 0, gl: 0, pf: 0, pa: 0 });
  prelims(S).filter(m => m.stage === "Group " + gk).forEach(m => {
    const r = res(S, m); if (!r.done) return;
    const A = st[m.a], B = st[m.b];
    A.p++; B.p++;
    A.gw += r.gw[0]; A.gl += r.gw[1]; B.gw += r.gw[1]; B.gl += r.gw[0];
    A.pf += r.pt[0]; A.pa += r.pt[1]; B.pf += r.pt[1]; B.pa += r.pt[0];
    if (r.winner === 0) { A.w++; B.l++; } else { B.w++; A.l++; }
  });
  const arr = Object.values(st);
  arr.forEach(x => x.pd = x.pf - x.pa);
  arr.sort((x, y) => y.w - x.w || y.gw - x.gw || y.pd - x.pd || x.t - y.t);
  // Teams level on all three: order them by ties won against each other.
  for (let i = 0; i < arr.length;) {
    let j = i + 1;
    while (j < arr.length && arr[j].w === arr[i].w && arr[j].gw === arr[i].gw && arr[j].pd === arr[i].pd) j++;
    if (j - i > 1) {
      const blk = arr.slice(i, j), ts = blk.map(x => x.t);
      const mini = t => ts.filter(o => o !== t && h2h(S, t, o) === -1).length;
      blk.sort((x, y) => mini(y.t) - mini(x.t) || x.t - y.t);
      arr.splice(i, j - i, ...blk);
    }
    i = j;
  }
  return arr;
}
export function prelimsDone(S) { return !!groups(S) && prelims(S).every(m => res(S, m).done); }
export function seeds(S) {
  if (!prelimsDone(S)) return null;
  const tA = table(S, "A"), tB = table(S, "B");
  const cmp = (x, y) => y.w - x.w || y.gw - x.gw || y.pd - x.pd || x.t - y.t;
  return {
    Cup: [...tA.slice(0, 2), ...tB.slice(0, 2)].sort(cmp).map(x => x.t),
    Plate: [...tA.slice(2), ...tB.slice(2)].sort(cmp).map(x => x.t)
  };
}
export function playoffs(S) {
  const sd = seeds(S), out = [];
  for (const br of ["Cup", "Plate"]) {
    const s = sd ? sd[br] : [null, null, null, null];
    const q1 = { id: br + "Q1", br, stage: BR[br], label: "Qualifier 1", a: s[0], b: s[1], la: "Seed 1", lb: "Seed 2" };
    const el = { id: br + "E", br, stage: BR[br], label: "Eliminator", a: s[2], b: s[3], la: "Seed 3", lb: "Seed 4" };
    const q2 = { id: br + "Q2", br, stage: BR[br], label: "Qualifier 2", a: loserTeam(S, q1), b: winnerTeam(S, el), la: "Loser Q1", lb: "Winner Eliminator" };
    const f = { id: br + "F", br, stage: BR[br], label: "Final", a: winnerTeam(S, q1), b: winnerTeam(S, q2), la: "Winner Q1", lb: "Winner Q2" };
    out.push(q1, el, q2, f);
  }
  return out;
}
export function allMatches(S) {
  return prelims(S).concat(playoffs(S));
}

/* ---------- courts ---------- */
export const courtCount = S => (S.settings && S.settings.courts) || 4;
export const courtOf = (S, m) => (S.court && S.court[m.id]) || null;
export const ready = m => m.a != null && m.b != null;
// A tie is on court once it is called to a court or has a game entered, until it is finished.
export function onCourt(S, m) {
  if (!ready(m)) return false;
  const r = res(S, m);
  return !r.done && (courtOf(S, m) != null || r.played > 0);
}
// Courts in use by ties that are not finished, as { court: tie }.
export function busyCourts(S) {
  const out = {};
  allMatches(S).forEach(m => { const c = courtOf(S, m); if (c && onCourt(S, m)) out[c] = m; });
  return out;
}
export function setCourt(S, id, c) {
  if (!S.court) S.court = {};
  if (c) S.court[id] = c; else delete S.court[id];
}
