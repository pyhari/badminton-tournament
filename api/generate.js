// Turns an organizer's plain-English description of a tournament into a
// tournament config, using Claude with structured outputs so the reply always
// matches api/_tournament-schema.json. The app then checks the config and shows
// it for review; nothing is created from it automatically.
// Only the organizer (with the admin PIN) can call this, since each call costs money.
const crypto = require("crypto");
const Anthropic = require("@anthropic-ai/sdk");
const SCHEMA = require("./_tournament-schema.json");

const MODEL = "claude-opus-5-5";
const MAX_DESCRIPTION = 2000;

const SYSTEM = `You design badminton tournaments for a club organizer. Turn their description into a tournament config.

How the club runs things today, for anything the description leaves open:
- 8 teams of 3 (Man 1, Man 2, Woman), drawn from pots by level so teams are even.
- A tie between two teams is 3 games: men's doubles (Man 1 + Man 2), mixed doubles 1 (Man 1 + Woman), mixed doubles 2 (Man 2 + Woman). Games to 15, win by 2, no cap.
- 2 groups of 4, everyone in a group plays each other once.
- IPL-style playoffs: "Champions League" for places 1-2 of each group, "FPL" for places 3-4.
- 4 courts, starting 09:00, about 12 minutes per game.

Rules for the config:
- Follow the description wherever it is clear. Use the club's way only for what it does not say.
- Every game's players must be roster slots, and no slot plays twice in the same game.
- With an even number of games in a tie, choose ifLevel deliberately (decider_game unless the description says otherwise).
- Playoff positions must exist in every group. An "ipl" bracket takes exactly 4 teams, "final_only" exactly 2.
- If the description asks for something impossible (such as 10 teams in groups of 4), make the closest sensible config and say what you changed in notes.
- Write each assumption you made in notes as one short sentence. Leave notes empty if you made none.`;

function pinOk(pin) {
  const want = process.env.ADMIN_PIN;
  if (!want || typeof pin !== "string") return false;
  const h = s => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(h(pin), h(want));
}

// The players and courts the organizer has now, so the config can fit them.
function contextLine(ctx) {
  if (!ctx || typeof ctx !== "object") return "";
  const n = v => (Number.isInteger(v) && v >= 0 && v < 1000 ? v : null);
  const parts = [];
  if (n(ctx.men) != null) parts.push(`${n(ctx.men)} men`);
  if (n(ctx.women) != null) parts.push(`${n(ctx.women)} women`);
  if (n(ctx.courts) != null) parts.push(`${n(ctx.courts)} courts`);
  return parts.length ? `\n\nAvailable right now: ${parts.join(", ")}.` : "";
}

async function generate(client, description, ctx) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // If Claude declines, the API retries on the model Anthropic recommends for that case.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `<description>\n${description}\n</description>${contextLine(ctx)}` }]
  });
  if (response.stop_reason === "refusal") return { status: 422, body: { error: "Claude could not help with that description. Try rewording it." } };
  if (response.stop_reason === "max_tokens") return { status: 502, body: { error: "The reply was cut off. Try a shorter description." } };
  const text = response.content.filter(b => b.type === "text").map(b => b.text).join("");
  let config;
  try { config = JSON.parse(text); } catch (e) { return { status: 502, body: { error: "Claude's reply was not a valid config. Try again." } }; }
  return { status: 200, body: { config, model: response.model } };
}

function makeHandler(getClient) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
    if (!process.env.ADMIN_PIN) return res.status(500).json({ error: "ADMIN_PIN is not set on the server" });
    if (!pinOk(req.headers["x-pin"])) return res.status(401).json({ error: "Wrong PIN" });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!description) return res.status(400).json({ error: "Describe the tournament first." });
    if (description.length > MAX_DESCRIPTION) return res.status(400).json({ error: `Keep the description under ${MAX_DESCRIPTION} characters.` });

    const client = getClient();
    if (!client) return res.status(500).json({ error: "AI is not set up: add ANTHROPIC_API_KEY in Vercel, then redeploy." });
    try {
      const out = await generate(client, description, body.context);
      return res.status(out.status).json(out.body);
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) return res.status(500).json({ error: "The ANTHROPIC_API_KEY on the server was not accepted." });
      if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: "Too many AI requests right now. Wait a minute and try again." });
      if (e instanceof Anthropic.APIError) {
        // The API's own message says what was wrong (such as no credit left). It holds no secrets,
        // and only the organizer sees it.
        const detail = (e.error && e.error.error && e.error.error.message) || e.message || "";
        console.error("Claude API error", e.status, e.requestID || "", detail);
        return res.status(502).json({ error: `AI service error (${e.status || "no status"}): ${detail}`.slice(0, 400) });
      }
      return res.status(502).json({ error: "Could not reach the AI service. Try again." });
    }
  };
}

// Turned off for now, so no AI calls are made. Set to true here and in src/screens/TestTools.jsx to turn it back on.
const AI_ON = false;
const off = (req, res) => res.status(503).json({ error: "The AI planner is turned off." });

module.exports = AI_ON ? makeHandler(() => (process.env.ANTHROPIC_API_KEY ? new Anthropic() : null)) : off;
module.exports.makeHandler = makeHandler;
module.exports.SYSTEM = SYSTEM;
