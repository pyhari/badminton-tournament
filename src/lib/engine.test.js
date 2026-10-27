import { describe, it, expect } from "vitest";
import * as E from "./engine.js";

const full = () => {
  const S = E.defaults();
  S.teams.forEach((x, i) => { x.m1 = E.MEN[i]; x.m2 = E.MEN[i + 8]; x.w = E.WOMEN[i]; });
  S.drawn = [0, 1, 2, 3, 4, 5, 6, 7];
  return S;
};
const win = (S, id, aWins) => { S.scores[id] = aWins ? [[15, 10], [15, 10], [10, 15]] : [[10, 15], [10, 15], [15, 10]]; };

describe("scoring", () => {
  it("knows a finished game", () => {
    expect(E.validGame({ a: 15, b: 13 })).toBe(true);
    expect(E.validGame({ a: 17, b: 15 })).toBe(true);
    expect(E.validGame({ a: 15, b: 14 })).toBe(false);
    expect(E.validGame({ a: 12, b: 10 })).toBe(false);
    expect(E.validGame({ a: 18, b: 15 })).toBe(false);
  });

  it("breaks a 3-way tie by team number and a 2-way tie by head to head", () => {
    const S = full();
    const beats = (a, b) => (a === 0 && b === 1) || (a === 1 && b === 2) || (a === 2 && b === 0);
    E.prelims(S).filter(m => m.stage === "Group A").forEach(m => win(S, m.id, beats(m.a, m.b) ? true : beats(m.b, m.a) ? false : m.a !== 3));
    expect(E.table(S, "A").map(x => x.t)).toEqual([0, 1, 2, 3]);
    const m01 = E.prelims(S).find(m => (m.a === 0 && m.b === 1) || (m.a === 1 && m.b === 0));
    win(S, m01.id, m01.a === 1);
    expect(E.table(S, "A")[0].t).toBe(1);
  });

  it("ignores stale playoff scores after an earlier result is corrected", () => {
    const S = full();
    E.prelims(S).forEach(m => win(S, m.id, m.a < m.b));
    expect(E.prelimsDone(S)).toBe(true);
    const po = () => Object.fromEntries(E.playoffs(S).map(m => [m.id, m]));
    const put = (id, aWins) => { const m = po()[id]; E.setScore(S, m, 0, 0, aWins ? 15 : 1); E.setScore(S, m, 0, 1, aWins ? 1 : 15); E.setScore(S, m, 1, 0, aWins ? 15 : 1); E.setScore(S, m, 1, 1, aWins ? 1 : 15); E.setScore(S, m, 2, 0, aWins ? 15 : 1); E.setScore(S, m, 2, 1, aWins ? 1 : 15); };
    put("CupQ1", true); put("CupE", true);
    const q2a = po().CupQ2.a; put("CupQ2", true);
    expect(E.res(S, po().CupQ2).done).toBe(true);
    S.scores.CupQ1 = [[1, 15], [1, 15], [1, 15]];
    const q2 = po().CupQ2;
    expect(q2.a).not.toBe(q2a);
    expect(E.res(S, q2).done).toBe(false);
    expect(E.scoresOf(S, q2)).toEqual([]);
  });
});

describe("migration", () => {
  it("builds the player list from typed teams and keeps the old draw", () => {
    const old = { teams: Array.from({ length: 8 }, (_, i) => ({ name: "T" + i, m1: E.MEN[i], m2: E.MEN[i + 8], w: E.WOMEN[i] })), drawn: [3, 1, 2, 0, 4, 5, 6, 7], scores: {}, who: {} };
    old.teams[0].m1 = "Guest";
    const S = E.fix(old);
    expect(S.locked).toBe(true);
    expect(S.players.find(p => p.name === "Guest" && p.g === "M").on).toBe(true);
    expect(S.players.filter(p => p.on && p.g === "M")).toHaveLength(16);
    expect(S.players.find(p => p.name === "Karan").on).toBe(false);
    expect(E.groups(S).A).toEqual([3, 1, 2, 0]);
    expect(E.teamIssues(S)).toEqual([]);
  });
});

describe("team draw", () => {
  const ready = () => {
    const S = E.defaults();
    S.players.find(p => p.name === "Karan").on = false;
    S.players.find(p => p.name === "Yuvaraj").on = false;
    const lv = [5, 5, 5, 4, 4, 4, 4, 3, 3, 3, 3, 2, 2, 2, 1, 1];
    S.players.filter(p => p.on && p.g === "M").forEach((p, i) => p.lvl = lv[i]);
    S.players.filter(p => p.g === "F").forEach((p, i) => p.lvl = [5, 4, 3, 3, 2, 2, 1, 1][i]);
    return S;
  };

  it("checks player numbers", () => {
    const S = E.defaults();
    expect(E.poolIssues(S)[0]).toMatch(/18 men .* Untick 2/);
    expect(E.poolIssues(ready())).toEqual([]);
  });

  it("makes even teams with Man 1 from the stronger pot", () => {
    const S = ready();
    E.drawTeams(S);
    const pw = S.teams.map((_, t) => E.power(S, t));
    expect(Math.max(...pw) - Math.min(...pw)).toBeLessThanOrEqual(1);
    expect(E.teamIssues(S)).toEqual([]);
    const p1 = S.teams.map(x => E.lvl(S, x.m1, "M")), p2 = S.teams.map(x => E.lvl(S, x.m2, "M"));
    expect(Math.min(...p1)).toBeGreaterThanOrEqual(Math.max(...p2));
  });

  it("swaps, subs in reserves and flags duplicates", () => {
    const S = ready();
    E.drawTeams(S);
    const a = S.teams[0].m1, b = S.teams[3].m2;
    E.swapSlots(S, { t: 0, f: "m1" }, { t: 3, f: "m2" });
    expect([S.teams[0].m1, S.teams[3].m2]).toEqual([b, a]);
    const gone = S.teams[5].m2;
    E.subIn(S, { t: 5, f: "m2" }, S.players.findIndex(p => p.name === "Karan"));
    expect(S.teams[5].m2).toBe("Karan");
    expect(E.findP(S, gone, "M").on).toBe(false);
    expect(E.poolIssues(S)).toEqual([]);
    S.teams[1].w = S.teams[2].w;
    expect(E.teamIssues(S).some(x => /both/.test(x))).toBe(true);
  });

  it("renames a player inside their team", () => {
    const S = ready();
    E.drawTeams(S);
    const i = S.players.findIndex(p => p.name === S.teams[2].w);
    expect(E.renamePlayer(S, i, "  Priya ")).toBe("");
    expect(S.teams[2].w).toBe("Priya");
    expect(E.renamePlayer(S, i, "hema")).toMatch(/already/);
    expect(E.renamePlayer(S, i, " ")).toMatch(/needs a name/);
  });
});

describe("group draw", () => {
  const drawn = () => {
    const S = E.defaults();
    S.players.find(p => p.name === "Karan").on = false;
    S.players.find(p => p.name === "Yuvaraj").on = false;
    S.players.forEach((p, i) => p.lvl = 1 + (i % 5));
    E.drawTeams(S);
    S.locked = true;
    while (S.picks.length < E.NT) E.pickNext(S);
    return S;
  };

  it("splits every pot across the groups and seats by pot", () => {
    const S = drawn(), g = E.groups(S);
    expect(new Set(g.A.concat(g.B)).size).toBe(8);
    S.pots.forEach((pt, i) => {
      expect(pt.filter(t => g.A.includes(t))).toHaveLength(1);
      expect(g.A[i]).toBe(S.picks[2 * i]);
      expect(g.B[i]).toBe(S.picks[2 * i + 1]);
    });
    expect(E.prelims(S)).toHaveLength(12);
  });

  it("always puts the two strongest teams in different groups", () => {
    for (let r = 0; r < 100; r++) {
      const S = drawn(), top = S.pots[0], A = E.groups(S).A;
      expect(A.includes(top[0])).not.toBe(A.includes(top[1]));
    }
  });
});

describe("misc", () => {
  it("makes team codes", () => {
    const S = E.defaults();
    S.teams[0].name = "Net Ninjas"; S.teams[1].name = "smashers";
    expect(E.abbr(S, 0)).toBe("NN");
    expect(E.abbr(S, 1)).toBe("SMA");
    expect(E.abbr(S, null)).toBe("TBD");
  });
  it("plans times", () => {
    const S = E.defaults();
    expect(E.roundTime(S, 2)).toBe("09:41");
    expect(E.endTime(S)).toBe("13:01");
  });
});
