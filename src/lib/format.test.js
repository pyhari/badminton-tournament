import { describe, it, expect } from "vitest";
import { createRequire } from "module";
import { CLUB_FORMAT, check, plan, headline, describe as words, roundRobin, groupSizes, isClubFormat } from "./format.js";

const require = createRequire(import.meta.url);
const SCHEMA = require("../../api/_tournament-schema.json");
const clone = x => structuredClone(x);

describe("tournament formats", () => {
  it("accepts the club format and times it", () => {
    expect(check(CLUB_FORMAT)).toEqual({ errors: [], warnings: [] });
    const p = plan(CLUB_FORMAT);
    expect(p.groupTies).toBe(12);
    expect(p.playoffTies).toBe(8);
    expect(p.games).toBe(60);
    // 3 group rounds + 3 playoff rounds, 36 minutes a tie, from 09:00.
    expect(p.finish).toBe("12:36");
    expect(headline(CLUB_FORMAT, p)).toMatch(/8 teams · 2 groups · 20 matches, 60 games · 4 courts/);
    expect(p.brackets[0].first[0]).toEqual(["1st Group A", "1st Group B", "Qualifier 1"]);
    expect(isClubFormat(CLUB_FORMAT)).toBe(true);
  });

  it("pairs every team once in a round robin", () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
      const seen = new Set();
      roundRobin(n).flat().forEach(([a, b]) => seen.add([a, b].sort().join()));
      expect(seen.size).toBe((n * (n - 1)) / 2);
    }
    expect(groupSizes(10, 3)).toEqual([4, 3, 3]);
  });

  it("flags formats that cannot run", () => {
    const c = clone(CLUB_FORMAT);
    c.teams.count = 10;
    const r = check(c);
    expect(r.errors.some(e => /IPL format needs exactly 4 teams/.test(e))).toBe(false); // places 1-2 x 2 groups is still 4
    expect(r.warnings.some(w => /uneven/.test(w))).toBe(false); // 10 in 2 groups is 5 and 5
    c.groups.count = 3;
    const r3 = check(c);
    expect(r3.errors.some(e => /needs exactly 4 teams, not 6/.test(e))).toBe(true);
    expect(r3.warnings.some(w => /uneven/.test(w))).toBe(true);

    const bad = clone(CLUB_FORMAT);
    bad.tie.games.push({ label: "Women's doubles", players: ["w", "w2"] });
    bad.game.cap = 15;
    bad.venue.start = "9am";
    const e = check(bad).errors.join(" ");
    expect(e).toMatch(/"w2" is not a player/);
    expect(e).toMatch(/cap \(15\) must be above/);
    expect(e).toMatch(/should look like 09:00/);
    expect(check(bad).warnings.join(" ")).toMatch(/can end 2–2/);
  });

  it("plans a straight knockout with byes", () => {
    const c = clone(CLUB_FORMAT);
    Object.assign(c, { groups: { count: 0, rounds: 0 }, playoffs: [{ name: "Cup", format: "knockout", positions: [] }] });
    c.teams.count = 6;
    expect(check(c).errors).toEqual([]);
    expect(check(c).warnings.join()).toMatch(/2 top seeds get a bye/);
    const p = plan(c);
    expect(p.ties).toBe(5);
    expect(p.brackets[0].first).toEqual([["Seed 3", "Seed 6", ""], ["Seed 4", "Seed 5", ""]]);
    expect(words(c, p).join(" ")).toMatch(/Cup: all teams, knockout: 5 matches/);
  });

  it("warns when there are not enough players", () => {
    const c = clone(CLUB_FORMAT);
    c.teams.roster.push({ slot: "w2", label: "Woman 2", gender: "F" });
    expect(check(c, { men: 16, women: 8 }).warnings.join()).toMatch(/Needs 16 women; 8 are ticked/);
  });

  it("keeps the AI schema and the club format in step", () => {
    const keys = o => Object.keys(o).sort();
    expect(keys(CLUB_FORMAT)).toEqual([...SCHEMA.required].sort());
    for (const k of ["teams", "tie", "game", "groups", "venue"]) expect(keys(CLUB_FORMAT[k])).toEqual([...SCHEMA.properties[k].required].sort());
  });
});

describe("AI generate endpoint", () => {
  const { makeHandler } = require("../../api/generate.js");
  const call = async (handler, { pin = "1234", body = { description: "8 teams, 2 groups", context: { men: 16, women: 8, courts: 4 } } } = {}) => {
    const res = { code: 0, json: null, headers: {} };
    res.status = c => { res.code = c; return res; };
    res.json = j => { res.out = j; return res; };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    await handler({ method: "POST", headers: { "x-pin": pin }, body }, res);
    return res;
  };
  const fake = reply => {
    const sent = [];
    return { sent, client: { beta: { messages: { create: async p => { sent.push(p); return reply; } } } } };
  };

  it("asks Claude for a config in the schema and returns it", async () => {
    process.env.ADMIN_PIN = "1234";
    const f = fake({ stop_reason: "end_turn", model: "claude-opus-5-5", content: [{ type: "text", text: JSON.stringify(CLUB_FORMAT) }] });
    const res = await call(makeHandler(() => f.client));
    expect(res.code).toBe(200);
    expect(res.out.config).toEqual(CLUB_FORMAT);
    const p = f.sent[0];
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.output_config.format).toEqual({ type: "json_schema", schema: SCHEMA });
    expect(p.fallbacks).toBe("default");
    expect(p.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(p.messages[0].content).toMatch(/<description>\n8 teams, 2 groups\n<\/description>\n\nAvailable right now: 16 men, 8 women, 4 courts\./);
  });

  it("needs the PIN and a description, and reports refusals", async () => {
    process.env.ADMIN_PIN = "1234";
    const f = fake({ stop_reason: "refusal", content: [] });
    expect((await call(makeHandler(() => f.client), { pin: "nope" })).code).toBe(401);
    expect((await call(makeHandler(() => f.client), { body: { description: "  " } })).code).toBe(400);
    expect((await call(makeHandler(() => null))).out.error).toMatch(/ANTHROPIC_API_KEY/);
    const r = await call(makeHandler(() => f.client));
    expect(r.code).toBe(422);
    expect(f.sent).toHaveLength(1); // nothing was sent without the PIN or a description
  });
});
