// Tournament formats described as data (see api/_tournament-schema.json):
// checks a format, works out its fixtures and timing, and describes it in words.
// Used to review formats the AI generator suggests. The running tournament
// does not use this yet; it still follows the club format in engine.js.

// The club's current format, as a config.
export const CLUB_FORMAT = {
  name: "Club Mixed Team Championship",
  teams: {
    count: 8,
    roster: [
      { slot: "m1", label: "Man 1", gender: "M" },
      { slot: "m2", label: "Man 2", gender: "M" },
      { slot: "w", label: "Woman", gender: "F" }
    ],
    formation: "balanced_draw"
  },
  tie: {
    games: [
      { label: "Men's doubles", players: ["m1", "m2"] },
      { label: "Mixed doubles 1", players: ["m1", "w"] },
      { label: "Mixed doubles 2", players: ["m2", "w"] }
    ],
    ifLevel: "none"
  },
  game: { pointsTo: 15, winBy: 2, cap: 0 },
  groups: { count: 2, rounds: 1 },
  playoffs: [
    { name: "Champions League", format: "ipl", positions: [1, 2] },
    { name: "FPL", format: "ipl", positions: [3, 4] }
  ],
  venue: { courts: 4, start: "09:00", minutesPerGame: 12 },
  notes: []
};

const FORMATION = { balanced_draw: "balanced draw from pots by level", random_draw: "random draw", organizer_picks: "teams picked by the organizer" };
const IF_LEVEL = { none: "", decider_game: "a decider game if level", total_points: "total points decide if level", draw: "level matches are draws" };
const ORD = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

// Group sizes as even as possible, larger groups first: 10 teams in 3 groups is [4, 3, 3].
export function groupSizes(teams, groups) {
  if (!groups) return [];
  return Array.from({ length: groups }, (_, i) => Math.floor(teams / groups) + (i < teams % groups ? 1 : 0));
}

// How many teams each bracket takes.
function bracketSize(c, b) {
  if (!c.groups.count) return c.teams.count;
  return b.positions.length * c.groups.count;
}

// Problems with a config. errors: it cannot be run as described. warnings: it can, but check.
// players (optional): { men, women } available now.
export function check(c, players) {
  const errors = [], warnings = [];
  const T = c.teams.count, slots = c.teams.roster.map(r => r.slot);
  if (!Number.isInteger(T) || T < 2) errors.push("A tournament needs at least 2 teams.");
  if (T > 64) errors.push("More than 64 teams is not supported.");
  if (!slots.length) errors.push("Each team needs at least one player.");
  if (new Set(slots).size !== slots.length) errors.push("Two player slots in a team have the same id.");

  if (!c.tie.games.length) errors.push("A match needs at least one game.");
  c.tie.games.forEach(g => {
    if (g.players.length < 1 || g.players.length > 2) errors.push(`${g.label}: a game is singles (1 player) or doubles (2).`);
    g.players.filter(p => !slots.includes(p)).forEach(p => errors.push(`${g.label}: "${p}" is not a player in the team.`));
    if (new Set(g.players).size !== g.players.length) errors.push(`${g.label}: the same player is listed twice.`);
  });
  const nGames = c.tie.games.length;
  if (nGames % 2 === 0 && c.tie.ifLevel === "none") warnings.push(`With ${nGames} games a match can end ${nGames / 2}–${nGames / 2}, and nothing decides it.`);
  if (c.tie.ifLevel === "draw" && c.playoffs.length) warnings.push("Playoff matches cannot be draws. They need a decider game or total points.");

  const { pointsTo, winBy, cap } = c.game;
  if (!(pointsTo >= 5 && pointsTo <= 50)) errors.push("Games should be played to between 5 and 50 points.");
  if (winBy !== 1 && winBy !== 2) errors.push("Win by must be 1 or 2 points.");
  if (cap && cap <= pointsTo) errors.push(`The cap (${cap}) must be above the winning score (${pointsTo}).`);

  const G = c.groups.count, sizes = groupSizes(T, G);
  if (G < 0 || (G > 0 && T / G < 2)) errors.push(`${plural(T, "team")} cannot make ${plural(G, "group")} of at least 2.`);
  if (G > 0 && c.groups.rounds !== 1 && c.groups.rounds !== 2) errors.push("Group teams play each other once or twice.");
  if (G > 0 && sizes.length && sizes[0] !== sizes[sizes.length - 1]) warnings.push(`Groups are uneven (${sizes.join(", ")} teams), so some teams play more group matches than others.`);

  const smallest = G ? Math.min(...sizes) : T;
  const used = new Set();
  if (!G && c.playoffs.length > 1) errors.push("Without a group stage there can be only one bracket.");
  if (!G && !c.playoffs.length) errors.push("With no group stage, add a knockout bracket.");
  c.playoffs.forEach(b => {
    if (G) {
      if (!b.positions.length) errors.push(`${b.name}: say which group places go into it.`);
      b.positions.forEach(p => {
        if (p < 1 || p > smallest) errors.push(`${b.name}: there is no ${ORD(p)} place in a group of ${smallest}.`);
        if (used.has(p)) errors.push(`${ORD(p)} place is in two brackets.`);
        used.add(p);
      });
    }
    const n = bracketSize(c, b);
    if (b.format === "ipl" && n !== 4) errors.push(`${b.name}: the IPL format needs exactly 4 teams, not ${n}.`);
    if (b.format === "final_only" && n !== 2) errors.push(`${b.name}: a single final needs exactly 2 teams, not ${n}.`);
    if (b.format === "knockout" && n < 2) errors.push(`${b.name}: a knockout needs at least 2 teams.`);
    if (b.format === "knockout" && n > 2 && (n & (n - 1))) warnings.push(`${b.name}: ${n} teams is not a power of 2, so ${nextPow2(n) - n} top seeds get a bye in round 1.`);
  });

  const { courts, start, minutesPerGame } = c.venue;
  if (!(courts >= 1 && courts <= 30)) errors.push("Courts should be between 1 and 30.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) errors.push(`Start time "${start}" should look like 09:00.`);
  if (!(minutesPerGame >= 3 && minutesPerGame <= 60)) errors.push("Minutes per game should be between 3 and 60.");

  if (players) {
    const need = g => c.teams.roster.filter(r => r.gender === g).length * T;
    if (players.men != null && need("M") > players.men) warnings.push(`Needs ${need("M")} men; ${players.men} are ticked as playing now.`);
    if (players.women != null && need("F") > players.women) warnings.push(`Needs ${need("F")} women; ${players.women} are ticked as playing now.`);
  }
  return { errors, warnings };
}
const nextPow2 = n => 2 ** Math.ceil(Math.log2(n));

// Round-robin pairings for n teams (circle method), as rounds of [i, j] index pairs.
export function roundRobin(n) {
  const ids = Array.from({ length: n + (n % 2) }, (_, i) => (i < n ? i : null)), rounds = [];
  for (let r = 0; r < ids.length - 1; r++) {
    const pairs = [];
    for (let i = 0; i < ids.length / 2; i++) {
      const a = ids[i], b = ids[ids.length - 1 - i];
      if (a != null && b != null) pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    ids.splice(1, 0, ids.pop());
  }
  return rounds;
}

// Knockout pairings for n entrants by seed (1 v n, 2 v n-1, ...), with byes for the top seeds.
function knockoutRounds(n) {
  const size = nextPow2(n), rounds = [];
  let first = [];
  for (let i = 1; i <= size / 2; i++) { const j = size + 1 - i; if (j <= n) first.push([i, j]); }
  rounds.push(first.length);
  for (let left = size / 2; left > 1; left /= 2) rounds.push(left / 2);
  return { first, rounds };
}

// Fixtures and timing for a valid config. Teams are placeholders (Team 1..N), seeded into groups in a snake.
export function plan(c) {
  const T = c.teams.count, G = c.groups.count, sizes = groupSizes(T, G);
  const letters = "ABCDEFGHIJKLMNOP";
  const groups = sizes.map((n, g) => ({ name: "Group " + letters[g], teams: [] }));
  for (let t = 0, row = 0; t < T && G; row++) {
    const order = row % 2 ? [...groups.keys()].reverse() : [...groups.keys()];
    for (const g of order) if (t < T && groups[g].teams.length < sizes[g]) groups[g].teams.push("Team " + ++t);
  }
  groups.forEach(gr => {
    gr.rounds = [];
    for (let leg = 0; leg < c.groups.rounds; leg++) {
      roundRobin(gr.teams.length).forEach(pairs => gr.rounds.push(pairs.map(([a, b]) => leg ? [gr.teams[b], gr.teams[a]] : [gr.teams[a], gr.teams[b]])));
    }
    gr.ties = gr.rounds.reduce((s, r) => s + r.length, 0);
  });

  const brackets = c.playoffs.map(b => {
    const n = bracketSize(c, b);
    const entrants = G
      ? b.positions.flatMap(p => groups.map(gr => `${ORD(p)} ${gr.name}`))
      : Array.from({ length: n }, (_, i) => "Seed " + (i + 1));
    if (b.format === "ipl") return { ...b, n, ties: 4, rounds: [2, 1, 1], first: [[entrants[0], entrants[1], "Qualifier 1"], [entrants[2], entrants[3], "Eliminator"]] };
    if (b.format === "final_only") return { ...b, n, ties: 1, rounds: [1], first: [[entrants[0], entrants[1], "Final"]] };
    const k = knockoutRounds(n);
    return { ...b, n, ties: n - 1, rounds: k.rounds, first: k.first.map(([i, j]) => [entrants[i - 1], entrants[j - 1], ""]) };
  });

  // Timing: a tie's games are played one after another on one court. A team plays one tie at a time,
  // so at most half the teams can be on court together.
  const gamesPerTie = c.tie.games.length, tieMin = gamesPerTie * c.venue.minutesPerGame;
  const groupTies = groups.reduce((s, g) => s + g.ties, 0);
  const waves = (ties, teamsIn) => Math.ceil(ties / Math.max(1, Math.min(c.venue.courts, Math.floor(teamsIn / 2))));
  const groupRounds = groups.length ? Math.max(...groups.map(g => g.rounds.length)) : 0;
  // Group stage: limited by courts, and by each group's own number of rounds.
  const groupWaves = groups.length ? Math.max(groupRounds, waves(groupTies, T)) : 0;
  const poRounds = Math.max(0, ...brackets.map(b => b.rounds.length));
  let poWaves = 0;
  for (let r = 0; r < poRounds; r++) {
    const ties = brackets.reduce((s, b) => s + (b.rounds[r] || 0), 0);
    poWaves += Math.ceil(ties / c.venue.courts);
  }
  const minutes = (groupWaves + poWaves) * tieMin;
  const [h, m] = (c.venue.start || "09:00").split(":").map(Number);
  const end = h * 60 + m + minutes;
  const finish = `${String(Math.floor(end / 60) % 24).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  const playoffTies = brackets.reduce((s, b) => s + b.ties, 0);
  return { groups, brackets, groupTies, playoffTies, ties: groupTies + playoffTies, games: (groupTies + playoffTies) * gamesPerTie, tieMin, minutes, finish };
}

// One line about the whole tournament.
export function headline(c, p) {
  const parts = [plural(c.teams.count, "team")];
  if (c.groups.count === 1) parts.push("one league");
  else if (c.groups.count > 1) parts.push(`${plural(c.groups.count, "group")}`);
  else parts.push("straight knockout");
  parts.push(`${p.ties} matches, ${p.games} games`);
  parts.push(plural(c.venue.courts, "court"));
  parts.push(`${c.venue.start}–${p.finish} (≈${Math.floor(p.minutes / 60)}h ${String(p.minutes % 60).padStart(2, "0")}m)`);
  return parts.join(" · ");
}

// The format in a few plain sentences, for review before anything is created.
export function describe(c, p) {
  const roster = c.teams.roster.map(r => r.label).join(", ");
  const game = `Games to ${c.game.pointsTo}${c.game.winBy === 2 ? ", win by 2" : ""}${c.game.cap ? `, capped at ${c.game.cap}` : ""}.`;
  const level = IF_LEVEL[c.tie.ifLevel];
  const lines = [
    `${plural(c.teams.count, "team")} of ${c.teams.roster.length} (${roster}), ${FORMATION[c.teams.formation] || c.teams.formation}.`,
    `When two teams meet they play ${plural(c.tie.games.length, "game")}: ${c.tie.games.map(g => g.label).join(", ")}${level ? `; ${level}` : ""}. ${game}`
  ];
  if (c.groups.count) {
    const sizes = groupSizes(c.teams.count, c.groups.count);
    lines.push(`${c.groups.count === 1 ? "One league" : plural(c.groups.count, "group")} of ${[...new Set(sizes)].join(" or ")}, playing each other ${c.groups.rounds === 2 ? "twice" : "once"}: ${plural(p.groupTies, "match", "matches")}.`);
  }
  p.brackets.forEach(b => {
    const places = `place${b.positions.length > 1 ? "s" : ""} ${b.positions.join(" and ")}`;
    const from = !c.groups.count ? "all teams" : c.groups.count === 1 ? places : `${places} from each group`;
    const fmt = b.format === "ipl" ? "IPL style (Qualifier 1, Eliminator, Qualifier 2, Final)" : b.format === "final_only" ? "a single final" : "knockout";
    lines.push(`${b.name}: ${from}, ${fmt}: ${plural(b.ties, "match", "matches")}.`);
  });
  lines.push(`With ${plural(c.venue.courts, "court")} and ~${c.venue.minutesPerGame} min a game (${p.tieMin} min a match), starting ${c.venue.start} it finishes around ${p.finish}.`);
  return lines;
}

// True if a config is the club's current format in everything that matters to the running app.
export function isClubFormat(c) {
  const shape = x => JSON.stringify([x.teams.count, x.teams.roster.map(r => r.gender), x.tie.games.length, x.groups, x.playoffs.map(b => [b.format, b.positions])]);
  return shape(c) === shape(CLUB_FORMAT);
}
