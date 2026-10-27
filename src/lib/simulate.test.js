import { describe, it, expect } from "vitest";
import * as E from "./engine.js";
import { simulate, quickSetup, threeWayTie, clearScores, summary, MODES } from "./simulate.js";

const fresh = () => { const S = E.defaults(); S.players.forEach((p, i) => p.lvl = 1 + (i * 7) % 5); quickSetup(S); return S; };

// Checks that the playoffs follow the IPL format from the final group tables.
function checkPlayoffs(S) {
  const A = E.table(S, "A").map(x => x.t), B = E.table(S, "B").map(x => x.t);
  const sd = E.seeds(S);
  expect(new Set(sd.Cup)).toEqual(new Set([A[0], A[1], B[0], B[1]]));
  expect(new Set(sd.Plate)).toEqual(new Set([A[2], A[3], B[2], B[3]]));
  for (const br of ["Cup", "Plate"]) {
    const po = Object.fromEntries(E.playoffs(S).filter(m => m.br === br).map(m => [m.label, m]));
    const s = sd[br];
    expect([po["Qualifier 1"].a, po["Qualifier 1"].b]).toEqual([s[0], s[1]]);
    expect([po.Eliminator.a, po.Eliminator.b]).toEqual([s[2], s[3]]);
    expect(po["Qualifier 2"].a).toBe(E.loserTeam(S, po["Qualifier 1"]));
    expect(po["Qualifier 2"].b).toBe(E.winnerTeam(S, po.Eliminator));
    expect(po.Final.a).toBe(E.winnerTeam(S, po["Qualifier 1"]));
    expect(po.Final.b).toBe(E.winnerTeam(S, po["Qualifier 2"]));
    expect(s).toContain(E.winnerTeam(S, po.Final));
    // The Eliminator loser can never reach the Final.
    expect([po.Final.a, po.Final.b]).not.toContain(E.loserTeam(S, po.Eliminator));
  }
}

describe("simulator", () => {
  it("plays whole tournaments in every mode with valid scores and correct playoffs", () => {
    for (let run = 0; run < 200; run++) {
      const S = fresh(), mode = Object.keys(MODES)[run % 4];
      simulate(S, { mode });
      const all = E.allMatches(S);
      expect(all.every(m => E.res(S, m).done)).toBe(true);
      expect(all.every(m => E.res(S, m).bad.length === 0)).toBe(true);
      checkPlayoffs(S);
    }
  });

  it("goes one round at a time and stops after the groups", () => {
    const S = fresh();
    expect(simulate(S, { upTo: "round" })).toBe(4);
    expect(E.currentRound(S)).toBe(2);
    simulate(S, { upTo: "groups" });
    expect(E.prelimsDone(S)).toBe(true);
    expect(E.currentRound(S)).toBe(4);
    expect(simulate(S, { upTo: "round" })).toBe(4); // Q1 and Eliminator in both brackets
    expect(simulate(S, { upTo: "round" })).toBe(2); // Qualifier 2s
    expect(simulate(S, { upTo: "round" })).toBe(2); // Finals
    expect(E.currentRound(S)).toBe(null);
  });

  it("makes a chosen team win everything, whichever team it is", () => {
    for (let t = 0; t < E.NT; t++) {
      const S = fresh();
      simulate(S, { team: t });
      const s = summary(S);
      expect(s.champ.Cup).toBe(t);
      expect(s[E.groups(S).A.includes(t) ? "A" : "B"][0]).toBe(t);
      checkPlayoffs(S);
    }
  });

  it("builds a three-way tie that falls back to team number", () => {
    const S = fresh();
    threeWayTie(S, "A");
    const g = E.groups(S).A, t = E.table(S, "A");
    expect(t.slice(0, 3).map(x => x.w)).toEqual([2, 2, 2]);
    expect(t[3].t).toBe(g[3]);
    expect(t.slice(0, 3).map(x => x.t)).toEqual(g.slice(0, 3).sort((a, b) => a - b));
  });

  it("keeps a manual result and clears scores for a rerun", () => {
    const S = fresh(), m = E.prelims(S)[0];
    [[15, 1], [15, 1], [15, 1]].forEach(([a, b], g) => { E.setScore(S, m, g, 0, a); E.setScore(S, m, g, 1, b); });
    simulate(S, { mode: "upsets" });
    expect(E.winnerTeam(S, m)).toBe(m.a);
    clearScores(S);
    expect(E.currentRound(S)).toBe(1);
  });
});
