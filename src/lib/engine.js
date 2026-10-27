// Tournament rules: teams, draws, fixtures, results, tables and playoffs.
// Every function takes the tournament state S and has no UI or storage code.

export const MEN = ["Arjun", "Bharani", "Chandru", "Dinesh", "Harikumar", "Praveen", "Shankar", "Harish", "Prabhu", "Justin", "Manoj", "Prem", "Rupesh", "Sai", "Shashank", "Karthik", "Yuvaraj", "Karan"];
export const WOMEN = ["Bharani", "Meenakshi", "Nandhini", "Hema", "Radha", "Vidhu", "Pradhu", "Nandini"];
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
  return s;
}

/* ---------- teams ---------- */
export const tn = (S, t) => t == null ? "To be decided" : (S.teams[t].name || "Team " + (t + 1));
export const tp = (S, t) => {
  if (t == null) return "";
  const x = S.teams[t];
  const men = [x.m1, x.m2].filter(Boolean).join(" & ");
  return [men, x.w].filter(Boolean).join(" + ");
};
// Short code for a team badge: initials of a multi-word name, else the first three letters.
export function abbr(S, t) {
  if (t == null) return "TBD";
  const words = tn(S, t).trim().split(/\s+/).filter(Boolean);
  const s = words.length > 1 ? words.map(w => w[0]).join("") : words[0] || "";
  return s.slice(0, 3).toUpperCase();
}
export function pairOf(S, t, i) {
  const x = S.teams[t];
  const a = x.m1 || "Man 1", b = x.m2 || "Man 2", w = x.w || "Woman";
  return i === 0 ? a + " & " + b : i === 1 ? a + " & " + w : b + " & " + w;
}
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
export function balancedTeams(S, rnd = cryptoRnd) {
  const men = byLevel(S.players.filter(p => p.on && p.g === "M"), rnd);
  const pots = [men.slice(0, NT), men.slice(NT), S.players.filter(p => p.on && p.g === "F")];
  let best = null, bestCost = Infinity;
  for (let k = 0; k < 60; k++) {
    const cols = pots.map(p => shuffle(p, rnd)); // cols[pot][team]
    const cost = () => {
      const s = Array.from({ length: NT }, (_, t) => cols[0][t].lvl + cols[1][t].lvl + cols[2][t].lvl);
      return (Math.max(...s) - Math.min(...s)) * 1e6 + s.reduce((a, v) => a + v * v, 0);
    };
    let c = cost(), better = true;
    while (better) {
      better = false;
      for (const col of cols) for (let i = 0; i < NT; i++) for (let j = i + 1; j < NT; j++) {
        [col[i], col[j]] = [col[j], col[i]];
        const c2 = cost();
        if (c2 < c) { c = c2; better = true; } else [col[i], col[j]] = [col[j], col[i]];
      }
    }
    if (c < bestCost) { best = cols; bestCost = c; }
  }
  return best;
}
export function drawTeams(S, rnd = cryptoRnd) {
  const cols = balancedTeams(S, rnd);
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
