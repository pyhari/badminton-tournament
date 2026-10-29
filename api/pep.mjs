// A short, warm message for a player who picks their name on the players' page.
// Written once per player (and team, once the teams are set) and saved, so each
// player costs at most one Claude call. Same on/off switch as the insights.
import Anthropic from "@anthropic-ai/sdk";
import { aiOn, fix } from "../src/lib/engine.js";
import { KEYS } from "./insights.mjs";
import { funFact } from "../src/lib/funFacts.js";

const PEP_ON = true; // the organizer can switch it off in Setup > More
const MODEL = "claude-opus-5-5";
const VERSION = "2:";
const DB_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const DB_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const SYSTEM = `You write one short message to a player at a friendly club badminton day, shown on their phone after they find their name.
Make them excited to play: warm, fun, a little playful. Under 25 words, one or two sentences.
Use only the facts given. If teammates are given, name them and cheer the team on; if not, the team draw is still to come.
If a fun fact about the player is given, play on it with a light, friendly joke; the app shows the fact itself, so don't repeat it word for word.
Never mention skill levels, ratings or who is stronger. No hashtags or emoji. Reply with the message only.`;

async function upstash(cmd) {
  const r = await fetch(DB_URL, { method: "POST", headers: { Authorization: "Bearer " + DB_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || out.error) throw new Error("Database error: " + (out.error || r.status));
  return out.result;
}

export function makePep({ enabled, db, getClient }) {
  return async (req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });
    res.setHeader("Cache-Control", "no-store");
    const client = enabled && getClient();
    if (!client) return res.status(200).json({ off: true });
    const name = String(req.query.name || "").slice(0, 60);
    try {
      const text = await db(["GET", KEYS.state]);
      const S = text ? fix(JSON.parse(text)) : null;
      // Only for players in the tournament, so the page cannot be used to run other prompts.
      const p = name && S && S.players.find(x => x.on && x.name === name);
      if (!p) return res.status(404).json({ error: "No such player" });
      if (!aiOn(S, "pep")) return res.status(200).json({ off: true });
      // The team counts once the teams are locked and full, as on the players' page.
      const set = S.locked && S.teams.every(x => x.m1 && x.m2 && x.w);
      const t = set ? S.teams.findIndex(x => [x.m1, x.m2, x.w].includes(name)) : -1;
      const team = t >= 0 ? { name: S.teams[t].name || "Team " + (t + 1), teammates: [S.teams[t].m1, S.teams[t].m2, S.teams[t].w].filter(n => n && n !== name) } : null;
      const key = KEYS.insights + ":pep:" + VERSION + name + "|" + (team ? team.name + ":" + team.teammates.join(",") : "");
      const saved = await db(["GET", key]);
      if (saved) return res.status(200).json({ text: saved });

      const facts = { player: name, teams: S.teams.length, playersInTournament: S.players.filter(x => x.on).length, trophies: ["FFBC Champions League (top 2 of each group)", "FFBC Premier League (3rd and 4th)"], team, funFact: funFact(name) };
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 1000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: SYSTEM,
        messages: [{ role: "user", content: `<facts>\n${JSON.stringify(facts)}\n</facts>` }]
      });
      if (response.stop_reason !== "end_turn") throw new Error("Claude stopped early: " + response.stop_reason);
      const out = response.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
      if (!out) throw new Error("Empty message");
      await db(["SET", key, out, "EX", String(7 * 24 * 3600)]);
      return res.status(200).json({ text: out });
    } catch (e) {
      console.error("Pep message not written:", e.status || "", e.message);
      return res.status(502).json({ error: "No message" });
    }
  };
}

export default makePep({
  enabled: PEP_ON && !!DB_URL,
  db: upstash,
  getClient: () => (process.env.ANTHROPIC_API_KEY ? new Anthropic() : null)
});
