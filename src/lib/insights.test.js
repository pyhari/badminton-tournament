import { describe, it, expect } from "vitest";
import * as E from "./engine.js";
import { tieFacts, dayFacts, factsKey } from "./insights.js";
import { makeHandler, KEYS } from "../../api/insights.mjs";

const full = () => {
  const S = E.defaults();
  S.teams.forEach((x, i) => { x.m1 = E.MEN[i]; x.m2 = E.MEN[i + 8]; x.w = E.WOMEN[i]; });
  S.drawn = [0, 1, 2, 3, 4, 5, 6, 7];
  return S;
};
const play = (S, m, games) => { S.scores[m.id] = games; S.who[m.id] = [m.a, m.b]; };

describe("tournament facts", () => {
  it("describes a finished tie: upset, comeback and closest game", () => {
    const S = full(), m = E.prelims(S)[0];
    S.players.find(p => p.name === S.teams[m.a].m1 && p.g === "M").lvl = 5;
    S.players.find(p => p.name === S.teams[m.a].m2 && p.g === "M").lvl = 5;
    expect(tieFacts(S, m)).toBe(null);
    play(S, m, [[15, 9], [16, 18], [12, 15]]); // the stronger team wins game 1, then loses
    const f = tieFacts(S, m);
    expect(f.winner).toBe(E.tn(S, m.b));
    expect(f.result).toBe("2–1");
    expect(f.upset).toBe(true);
    expect(f.cameFromBehind).toBe(true);
    expect(f.closestGame).toBe("Mixed doubles 1");
    expect(f.games[1]).toMatchObject({ score: "18–16", extraPoints: true, winningPair: E.pairOf(S, m.b, 1) });
  });

  it("says who is through or out only when it is certain", () => {
    const S = full();
    expect(dayFacts(S)).toBe(null);
    // Seat 1 of Group A wins all three of its ties; seat 4 loses all three.
    const g = E.groups(S).A;
    E.prelims(S).filter(m => m.stage === "Group A").forEach(m => {
      const aWins = m.a === g[0] || m.b === g[3];
      play(S, m, aWins ? [[15, 5], [15, 5], [15, 5]] : [[5, 15], [5, 15], [5, 15]]);
    });
    const rows = dayFacts(S).groups["Group A"];
    const by = t => rows.find(r => r.team === E.tn(S, t));
    expect(by(g[0]).status).toBe("through");
    expect(by(g[3]).status).toBe("out");
    // Every Group A tie is played, so all four places are settled.
    expect(rows.filter(r => r.status === "through")).toHaveLength(2);
    expect(rows.filter(r => r.status === "out")).toHaveLength(2);
    expect(dayFacts(S).groups["Group B"].every(r => r.status === "in contention")).toBe(true);
  });
});

describe("insights endpoint", () => {
  const setup = () => {
    const S = full(), store = { [KEYS.state]: null }, calls = [], jobs = [];
    const db = async ([cmd, ...a]) => {
      if (cmd === "MGET") return a.map(k => store[k] ?? null);
      if (cmd === "SET") { if (a[2] === "NX" && store[a[0]]) return null; store[a[0]] = a[1]; return "OK"; }
      if (cmd === "DEL") { delete store[a[0]]; return 1; }
    };
    let reply = null, clock = 1e6;
    const client = { beta: { messages: { create: async p => { calls.push(p); return reply(p); } } } };
    const handler = makeHandler({ enabled: true, db, getClient: () => client, background: p => jobs.push(p), now: () => clock });
    const get = async () => {
      const res = { headers: {} };
      res.status = c => { res.code = c; return res; };
      res.json = j => { res.out = j; return res; };
      res.setHeader = (k, v) => { res.headers[k] = v; };
      await handler({ method: "GET" }, res);
      await Promise.all(jobs.splice(0));
      return res;
    };
    const save = () => { store[KEYS.state] = JSON.stringify(S); };
    return { S, store, calls, get, save, setReply: r => { reply = r; }, tick: ms => { clock += ms; } };
  };

  it("writes once when results change, then serves the saved words", async () => {
    const t = setup(), [m1, m2] = E.prelims(t.S);
    expect((await t.get()).out).toEqual({ story: null, recaps: {} });
    play(t.S, m1, [[15, 9], [15, 9], [9, 15]]); t.save();
    t.setReply((p) => ({ stop_reason: "end_turn", model: "claude-opus-5-5", content: [{ type: "text", text: JSON.stringify({ story: { headline: "Day one", paragraphs: ["p"] }, recaps: [{ id: m1.id, text: "Great start." }] }) }] }));
    const first = await t.get();
    expect(first.out.story).toBe(null); // the write runs in the background; this reply has the old (empty) words
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0].output_config.format.type).toBe("json_schema");
    expect(t.calls[0].messages[0].content).toMatch(new RegExp(`"id":"${m1.id}"`));
    const second = await t.get();
    expect(second.out.story.headline).toBe("Day one");
    expect(second.out.recaps).toEqual({ [m1.id]: "Great start." });
    expect(second.out.current).toBe(true);
    expect(t.calls).toHaveLength(1); // nothing changed, no new call
    expect(second.headers["Cache-Control"]).toMatch(/s-maxage=10/);

    // Another result within 45 seconds waits; after that, one call writes only the new recap.
    play(t.S, m2, [[15, 9], [15, 9], [15, 9]]); t.save();
    await t.get();
    expect(t.calls).toHaveLength(1);
    t.tick(46000);
    t.setReply(p => ({ stop_reason: "end_turn", model: "claude-opus-5-5", content: [{ type: "text", text: JSON.stringify({ story: { headline: "Two down", paragraphs: ["p"] }, recaps: [{ id: m2.id, text: "A sweep." }] }) }] }));
    await t.get();
    expect(t.calls).toHaveLength(2);
    expect(t.calls[1].messages[0].content).not.toMatch(new RegExp(`"id":"${m1.id}"`));
    const third = await t.get();
    expect(third.out.recaps).toEqual({ [m1.id]: "Great start.", [m2.id]: "A sweep." });

    // A corrected score hides that tie's old recap until a new one is written.
    play(t.S, m1, [[9, 15], [9, 15], [9, 15]]); t.save();
    t.setReply(() => { throw Object.assign(new Error("credit"), { status: 400 }); });
    t.tick(46000);
    const fourth = await t.get();
    expect(fourth.out.recaps[m1.id]).toBeUndefined();
    expect(fourth.out.current).toBe(false);
    // The failure is remembered, so it does not retry on every request.
    await t.get();
    expect(t.calls).toHaveLength(3);
    expect(JSON.parse(t.store[KEYS.insights]).failAt).toBeTruthy();
    expect(t.store[KEYS.lock]).toBeUndefined();
  });

  it("is quiet when switched off", async () => {
    const handler = makeHandler({ enabled: false });
    const res = { status: c => res, json: j => { res.out = j; return res; }, setHeader() {} };
    await handler({ method: "GET" }, res);
    expect(res.out).toEqual({ off: true });
  });

  it("changes its key only when results change", () => {
    const S = full(), k0 = factsKey(S);
    S.court = { x: 1 };
    expect(factsKey(S)).toBe(k0);
    play(S, E.prelims(S)[0], [[15, 9], [15, 9], [15, 9]]);
    expect(factsKey(S)).not.toBe(k0);
  });
});
