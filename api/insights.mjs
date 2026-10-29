// AI match recaps and a "story so far" for the players' page (/watch).
// Players only ever read what is saved. When results change, the first player
// request after that starts one Claude call in the background (at most one
// every 45 seconds), and its words are saved for everyone. The facts come from
// src/lib/insights.js; Claude only writes them up.
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { waitUntil } from "@vercel/functions";
import { fix, allMatches, anyAi } from "../src/lib/engine.js";
import { dayFacts, tieFacts, factsKey, tieKey, highlights, outlookFacts } from "../src/lib/insights.js";

// On everywhere; the organizer turns each AI feature on or off in Setup > More (S.settings.ai).
const INSIGHTS_ON = true;
const MODEL = "claude-opus-5-5";
// Bump when the wording rules change, so saved words are written again.
const VERSION = "8:";
const recapKey = t => VERSION + tieKey(t);
const MIN_GAP = 20 * 1000, RETRY_AFTER = 5 * 60 * 1000, LOCK_SECS = 120;

const DB_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const DB_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const ENV = process.env.VERCEL_ENV;
const NS = "badminton:" + (ENV && ENV !== "production" ? ENV + ":" : "");
export const KEYS = { state: NS + "state", insights: NS + "insights", lock: NS + "insights:lock" };

const SYSTEM = `You write short, lively updates for players at a club badminton tournament, read on their phones between matches.
Use only the facts given. Never invent scores, players, shots or events. Name teams and players exactly as given.
A match is one team against another, made of 3 games. Always say "match" for it, never "tie".
Recaps: 1–2 sentences per match, under 45 words. Lead with what made it interesting: an upset, a comeback, a close or extra-points game, a clean sweep.
Story so far: the app already shows the standings, who is through or out, the champions and a card for each highlight with its teams and score, so do not repeat numbers it shows. Write:
- headline: under 9 words, the big story of the day so far.
- lede: one sentence, under 28 words, setting the scene.
- one caption per highlight, under 16 words, saying why that match mattered.
Recaps sit under each match card, which shows the scores.
Outlook: the app predicts, for each unfinished group, which 2 teams are likely to finish top 2 (into the FFBC Champions League) and which 2 are likely 3rd or 4th (into the FFBC Premier League). Write for casual players, in plain everyday words:
- one group summary, under 30 words: name the 2 teams likely for the Champions League and the 2 likely for the Premier League, and the match that could change it, if any.
- one reason per team, under 14 words, for why it is predicted to go where it is: wins so far and how strong the teams it still has to play are (strength is the sum of player levels; say "stronger" or "weaker", never the numbers). Don't repeat the chance or percentage the app shows.
Say "likely", "needs" or "could", never "will". No jargon such as "point difference" or "strength rating".
Name the players, not just the team: in each recap, the pair(s) who won the key games; in each caption and outlook reason, at least one player of the team. Write names exactly as given, keeping their order (the woman first in a mixed pair).
Teams finishing 3rd or 4th in a group are not eliminated: they go on to the FFBC Premier League.
Call the two playoffs "the Champions League" and "the Premier League" (or "the FFBC Champions League" and "the FFBC Premier League"). Never "FPL", "Cup" or "Plate".
Warm and fun, never mocking the losing side. No hashtags or emoji.`;

// Two calls run side by side, so new words arrive in about half the time:
// one for the story and predictions, one for the match recaps.
const STORY_SCHEMA = {
  type: "object", additionalProperties: false, required: ["story", "groups", "outlook"],
  properties: {
    story: {
      type: "object", additionalProperties: false, required: ["headline", "lede", "captions"],
      properties: {
        headline: { type: "string" },
        lede: { type: "string" },
        captions: {
          type: "array",
          items: { type: "object", additionalProperties: false, required: ["key", "caption"], properties: { key: { type: "string" }, caption: { type: "string" } } }
        }
      }
    },
    groups: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["group", "summary"], properties: { group: { type: "string" }, summary: { type: "string" } } }
    },
    outlook: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["t", "reason"], properties: { t: { type: "integer" }, reason: { type: "string" } } }
    }
  }
};
const RECAP_SCHEMA = {
  type: "object", additionalProperties: false, required: ["recaps"],
  properties: {
    recaps: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["id", "text"], properties: { id: { type: "string" }, text: { type: "string" } } }
    }
  }
};

async function upstash(cmd) {
  const r = await fetch(DB_URL, { method: "POST", headers: { Authorization: "Bearer " + DB_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || out.error) throw new Error("Database error: " + (out.error || r.status));
  return out.result;
}

// Writes recaps for finished ties that have none (or whose score changed) and a fresh story.
export async function write(client, S, saved) {
  const ties = allMatches(S).filter(m => m.a != null && m.b != null).map(m => tieFacts(S, m)).filter(Boolean);
  const need = ties.filter(t => !saved.recaps[t.id] || saved.recaps[t.id].key !== recapKey(t));
  const cards = highlights(S).map(h => ({ key: h.key, kind: h.kind, match: h.match, game: h.game }));
  const outlook = outlookFacts(S);
  const ask = async (schema, content) => {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      system: SYSTEM,
      messages: [{ role: "user", content }]
    });
    if (response.stop_reason !== "end_turn") throw new Error("Claude stopped early: " + response.stop_reason);
    return { ...JSON.parse(response.content.filter(b => b.type === "text").map(b => b.text).join("")), model: response.model };
  };
  const [main, more] = await Promise.all([
    ask(STORY_SCHEMA, `<day>\n${JSON.stringify(dayFacts(S))}\n</day>\n<highlights>\n${JSON.stringify(cards)}\n</highlights>\n<outlook>\n${JSON.stringify(outlook)}\n</outlook>\nWrite the story so far with one caption per highlight (using its key), one summary per group in <outlook> (using its group name) and one reason per team in <outlook> (using its t).`),
    need.length ? ask(RECAP_SCHEMA, `<matches_needing_recaps>\n${JSON.stringify(need)}\n</matches_needing_recaps>\nWrite one recap for each match (using its id).`) : { recaps: [] }
  ]);
  const out = { ...main, recaps: more.recaps || [] };
  const recaps = { ...saved.recaps };
  for (const r of out.recaps) {
    const t = need.find(x => x.id === r.id);
    if (t && r.text) recaps[t.id] = { key: recapKey(t), text: r.text.trim() };
  }
  const keys = new Set(cards.map(c => c.key));
  const story = { headline: out.story.headline, lede: out.story.lede, captions: Object.fromEntries(out.story.captions.filter(c => keys.has(c.key)).map(c => [c.key, c.caption.trim()])) };
  const teams = new Set(outlook.flatMap(g => g.teams.map(o => o.t))), names = new Set(outlook.map(g => g.group));
  const reasons = Object.fromEntries((out.outlook || []).filter(o => teams.has(o.t) && o.reason).map(o => [o.t, o.reason.trim()]));
  const forecast = Object.fromEntries((out.groups || []).filter(g => names.has(g.group) && g.summary).map(g => [g.group, g.summary.trim()]));
  return { story, reasons, forecast, recaps, model: main.model };
}

// What players see: the story and the recaps that still match the scores.
function view(S, saved, key) {
  if (!saved.story) return { story: null, recaps: {}, at: null };
  const recaps = {};
  allMatches(S).filter(m => m.a != null && m.b != null).forEach(m => {
    const t = tieFacts(S, m), r = t && saved.recaps[m.id];
    if (r && r.key === recapKey(t)) recaps[m.id] = r.text;
  });
  // The prediction is for the results it was written for, so it is shown only while current.
  const current = saved.key === key;
  return { story: saved.story, recaps, reasons: current ? saved.reasons || {} : {}, forecast: current ? saved.forecast || {} : {}, at: saved.at, current };
}

// The organizer PIN, as in api/state.js.
function adminPin(pin) {
  const want = process.env.ADMIN_PIN;
  if (!want || typeof pin !== "string") return false;
  const h = s => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(h(pin), h(want));
}

export function makeHandler({ enabled, db, getClient, background, now = () => Date.now(), pinOk = adminPin }) {
  // The organizer's "Refresh now": writes straight away, skipping the waits between writes
  // and after a failure, and replies once the new words are saved.
  const refresh = async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    // Wrong PINs are counted per address, as in api/state.js, so the PIN cannot be guessed here.
    const ip = String((req.headers && req.headers["x-forwarded-for"]) || "").split(",")[0].trim() || "unknown";
    const failKey = NS + "fails:" + ip;
    if ((Number(await db(["GET", failKey])) || 0) >= 10) return res.status(429).json({ error: "Too many wrong PINs. Wait 15 minutes" });
    if (!pinOk(req.headers && req.headers["x-pin"])) {
      await db(["INCR", failKey]); await db(["EXPIRE", failKey, String(15 * 60)]);
      return res.status(401).json({ error: "Wrong PIN" });
    }
    const client = enabled && getClient();
    if (!client) return res.status(200).json({ off: true });
    const [text, savedText] = await db(["MGET", KEYS.state, KEYS.insights]);
    const S = text ? fix(JSON.parse(text)) : null;
    const key = S && factsKey(S) ? VERSION + factsKey(S) : "";
    if (!key) return res.status(200).json({ error: "No results yet" });
    if (!anyAi(S)) return res.status(200).json({ error: "Every AI feature is switched off" });
    if ((await db(["SET", KEYS.lock, "1", "NX", "EX", String(LOCK_SECS)])) !== "OK") return res.status(409).json({ error: "Already writing. Try again in a minute" });
    const saved = (savedText && JSON.parse(savedText)) || { recaps: {} };
    try {
      const out = await write(client, S, saved);
      await db(["SET", KEYS.insights, JSON.stringify({ ...out, key, at: now() })]);
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error("Insights not written:", e.status || "", e.message);
      return res.status(502).json({ error: "Claude did not answer. Try again" });
    } finally { await db(["DEL", KEYS.lock]); }
  };
  return async (req, res) => {
    if (req.method === "POST") return refresh(req, res);
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });
    if (!enabled) return res.status(200).json({ off: true });
    try {
      const [text, savedText] = await db(["MGET", KEYS.state, KEYS.insights]);
      const S = text ? fix(JSON.parse(text)) : null;
      const saved = (savedText && JSON.parse(savedText)) || { recaps: {} };
      const key = S && factsKey(S) ? VERSION + factsKey(S) : "";
      const client = getClient();
      // Results changed since the last write: start one in the background, if it is time.
      const due = key && key !== saved.key && anyAi(S) && client && now() - (saved.at || 0) > MIN_GAP && now() - (saved.failAt || 0) > RETRY_AFTER;
      if (due && (await db(["SET", KEYS.lock, "1", "NX", "EX", String(LOCK_SECS)])) === "OK") {
        background((async () => {
          try {
            const out = await write(client, S, saved);
            await db(["SET", KEYS.insights, JSON.stringify({ ...out, key, at: now() })]);
          } catch (e) {
            console.error("Insights not written:", e.status || "", e.message);
            await db(["SET", KEYS.insights, JSON.stringify({ ...saved, failAt: now() })]);
          } finally { await db(["DEL", KEYS.lock]); }
        })());
      }
      // Shared from Vercel's edge for 5 seconds, so phones polling it cost almost nothing;
      // for 2 seconds while new words are being written, so they show up soon after.
      const out = S && key ? view(S, saved, key) : { story: null, recaps: {} };
      res.setHeader("Cache-Control", out.current === false ? "public, max-age=0, s-maxage=2, stale-while-revalidate=2" : "public, max-age=0, s-maxage=5, stale-while-revalidate=5");
      return res.status(200).json(out);
    } catch (e) {
      console.error("Insights error:", e.message);
      res.setHeader("Cache-Control", "no-store");
      return res.status(502).json({ error: "Could not load the story" });
    }
  };
}

export default makeHandler({
  enabled: INSIGHTS_ON && !!DB_URL,
  db: upstash,
  getClient: () => (process.env.ANTHROPIC_API_KEY ? new Anthropic() : null),
  background: waitUntil
});
