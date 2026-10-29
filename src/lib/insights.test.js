import { describe, it, expect } from "vitest";
import * as E from "./engine.js";
import { tieFacts, dayFacts, factsKey, highlights, matchTag, groupRace, champions, top2Odds, predict, outlookFacts } from "./insights.js";
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
    const rows = groupRace(S)[0].rows;
    const by = t => rows.find(r => r.t === t);
    expect(by(g[0]).status).toBe("through");
    expect(by(g[3]).status).toBe("out");
    // Before the last match: seat 1 is through on wins alone, seat 4 is out, the middle two are not settled.
    const last = E.prelims(S).filter(m => m.stage === "Group A").find(m => [m.a, m.b].includes(g[1]) && [m.a, m.b].includes(g[2]));
    const keep = S.scores[last.id]; delete S.scores[last.id];
    expect(groupRace(S)[0].rows.filter(r => r.status === "in contention")).toHaveLength(2);
    S.scores[last.id] = keep;
    // Every Group A match is played, so all four places are settled.
    expect(rows.filter(r => r.status === "through")).toHaveLength(2);
    expect(rows.filter(r => r.status === "out")).toHaveLength(2);
    expect(groupRace(S)[1].rows.every(r => r.status === "in contention")).toBe(true);
    // Claude is told where 3rd and 4th go, so it never calls them eliminated.
    expect(dayFacts(S).groups["Group A"].find(r => r.team === E.tn(S, g[3])).status).toBe("certain 3rd or 4th: into the Premier League");
  });
});

describe("highlight cards and tags", () => {
  it("picks different matches for the upset, the thriller, a comeback and a sweep", () => {
    const S = full(), [m1, m2, m3, m4] = E.prelims(S);
    S.players.find(p => p.name === S.teams[m1.a].m1 && p.g === "M").lvl = 5;
    S.players.find(p => p.name === S.teams[m1.a].m2 && p.g === "M").lvl = 5;
    play(S, m1, [[5, 15], [6, 15], [7, 15]]);   // weaker side sweeps: upset
    play(S, m2, [[15, 9], [19, 17], [15, 9]]);  // 19-17: thriller
    play(S, m3, [[9, 15], [15, 9], [15, 9]]);   // lost game 1: comeback
    play(S, m4, [[15, 2], [15, 2], [15, 2]]);   // sweep
    const h = highlights(S);
    expect(h.map(x => x.kind)).toEqual(["upset", "thriller", "comeback"]);
    expect(h.map(x => x.match.id)).toEqual([m1.id, m2.id, m3.id]);
    expect(h[1].game.score).toBe("19–17");
    expect(matchTag(tieFacts(S, m1))).toBe("Upset");
    expect(matchTag(tieFacts(S, m2))).toBe("19–17 thriller");
    expect(matchTag(tieFacts(S, m3))).toBe("Comeback");
    expect(matchTag(tieFacts(S, m4))).toBe("Clean sweep");
    expect(groupRace(S).map(g => g.rows.length)).toEqual([4, 4]);
    expect(champions(S)).toEqual([]);
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

  it("writes nothing when the organizer switches every AI feature off", async () => {
    const t = setup(), [m1] = E.prelims(t.S);
    t.S.settings.ai = { story: false, recaps: false, race: false, pep: false };
    play(t.S, m1, [[15, 9], [15, 9], [9, 15]]); t.save();
    await t.get();
    expect(t.calls).toHaveLength(0);
  });

  it("writes once when results change, then serves the saved words", async () => {
    const t = setup(), [m1, m2] = E.prelims(t.S);
    expect((await t.get()).out).toEqual({ story: null, recaps: {} });
    play(t.S, m1, [[15, 9], [15, 9], [9, 15]]); t.save();
    t.setReply((p) => ({ stop_reason: "end_turn", model: "claude-opus-5-5", content: [{ type: "text", text: JSON.stringify({ story: { headline: "Day one", lede: "It begins.", captions: [{ key: "upset:nope", caption: "Made up" }] }, recaps: [{ id: m1.id, text: "Great start." }] }) }] }));
    const first = await t.get();
    expect(first.out.story).toBe(null); // the write runs in the background; this reply has the old (empty) words
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0].output_config.format.type).toBe("json_schema");
    expect(t.calls[0].messages[0].content).toMatch(new RegExp(`"id":"${m1.id}"`));
    const second = await t.get();
    expect(second.out.story).toEqual({ headline: "Day one", lede: "It begins.", captions: {} }); // a caption for no real highlight is dropped
    expect(second.out.recaps).toEqual({ [m1.id]: "Great start." });
    expect(second.out.current).toBe(true);
    expect(t.calls).toHaveLength(1); // nothing changed, no new call
    expect(second.headers["Cache-Control"]).toMatch(/s-maxage=10/);

    // Another result within 20 seconds waits; after that, one call writes only the new recap.
    play(t.S, m2, [[15, 9], [15, 9], [15, 9]]); t.save();
    await t.get();
    expect(t.calls).toHaveLength(1);
    t.tick(21000);
    t.setReply(p => ({ stop_reason: "end_turn", model: "claude-opus-5-5", content: [{ type: "text", text: JSON.stringify({ story: { headline: "Two down", lede: "Two in.", captions: [{ key: "sweep:" + m2.id, caption: "Total control. " }] }, recaps: [{ id: m2.id, text: "A sweep." }] }) }] }));
    await t.get();
    expect(t.calls).toHaveLength(2);
    expect(t.calls[1].messages[0].content).not.toMatch(new RegExp(`"id":"${m1.id}"`));
    const third = await t.get();
    expect(third.out.recaps).toEqual({ [m1.id]: "Great start.", [m2.id]: "A sweep." });
    expect(third.out.story.captions).toEqual({ ["sweep:" + m2.id]: "Total control." });
    expect(t.calls[1].messages[0].content).toMatch(/<highlights>\n\[\{"key":"sweep:/);

    // A corrected score hides that tie's old recap until a new one is written.
    play(t.S, m1, [[9, 15], [9, 15], [9, 15]]); t.save();
    t.setReply(() => { throw Object.assign(new Error("credit"), { status: 400 }); });
    t.tick(21000);
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

describe("top-2 odds", () => {
  it("are the same every time, sum to 200% per group, and follow results", () => {
    const S = full();
    S.players.forEach((p, i) => { p.lvl = 1 + (i % 5); });
    const a = top2Odds(S), b = top2Odds(S);
    expect(a).toEqual(b); // seeded: every phone shows the same numbers
    a.forEach(g => expect(g.rows.reduce((n, r) => n + r.pct, 0)).toBeGreaterThanOrEqual(196));
    const strongest = a[0].rows.reduce((x, y) => (E.power(S, y.t) > E.power(S, x.t) ? y : x));
    expect(Math.max(...a[0].rows.map(r => r.pct))).toBe(strongest.pct);
    // Play all of Group A: the odds become certain and the group is settled.
    E.prelims(S).filter(m => m.stage === "Group A").forEach(m => play(S, m, [[15, 9], [15, 9], [15, 9]]));
    const g = top2Odds(S)[0];
    expect(g.settled).toBe(true);
    expect(g.rows.map(r => r.pct).sort((x, y) => y - x)).toEqual([100, 100, 0, 0]);
  });
});

describe("Champions League prediction", () => {
  it("puts the 2 likeliest teams of each unfinished group in the Champions League and the rest in the Premier League", () => {
    const S = full();
    S.players.forEach((p, i) => { p.lvl = 1 + (i % 5); });
    const [m] = E.prelims(S).filter(x => x.stage === "Group A");
    play(S, m, [[15, 9], [15, 9], [15, 9]]);
    const g = predict(S)[0], odds = top2Odds(S)[0];
    expect(g.cl).toHaveLength(2);
    expect(g.fpl).toHaveLength(2);
    const pct = t => odds.rows.find(r => r.t === t).pct;
    expect(Math.min(...g.cl.map(r => pct(r.t)))).toBeGreaterThanOrEqual(Math.max(...g.fpl.map(r => pct(r.t))));
    // A Premier League team's chance is its chance of finishing 3rd or 4th.
    g.fpl.forEach(r => expect(r.chance).toBe(100 - pct(r.t)));
    // The matches that could change it are between a predicted Champions League team and a Premier League team.
    const top = new Set(g.cl.map(r => r.t));
    g.key.forEach(x => expect(top.has(x.a)).not.toBe(top.has(x.b)));
    expect(outlookFacts(S)[0]).toMatchObject({ group: "Group A", likelyChampionsLeague: g.cl.map(r => E.tn(S, r.t)) });
    // A finished group shows where its teams went, and the AI is asked only about the other.
    E.prelims(S).filter(x => x.stage === "Group A").forEach(x => play(S, x, [[15, 9], [15, 9], [15, 9]]));
    const a = predict(S)[0];
    expect(a.settled).toBe(true);
    expect([...a.cl, ...a.fpl].map(r => r.word)).toEqual(["Confirmed", "Confirmed", "Confirmed", "Confirmed"]);
    expect(outlookFacts(S).map(x => x.group)).toEqual(["Group B"]);
  });
});
