// Stores the tournament state in an Upstash Redis database.
// Anyone can read. Only a request with the right PIN can write.
// Every save bumps a revision number, so a device holding old data cannot
// overwrite newer data by accident.
const crypto = require("crypto");

const DB_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const DB_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const KEY = "badminton:state";
const REV = "badminton:rev";
const MAX_FAILS = 10, FAIL_WINDOW = 15 * 60;

// Saves only when the stored revision matches the one the client started from.
const SAVE = `
local r = tonumber(redis.call('GET', KEYS[2]) or '0')
if r ~= tonumber(ARGV[1]) then return {0, r} end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], r + 1)
return {1, r + 1}`;

async function redis(cmd) {
  const r = await fetch(DB_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + DB_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd)
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok || out.error) throw new Error("Database error: " + (out.error || r.status));
  return out.result;
}

function pinOk(pin) {
  const want = process.env.ADMIN_PIN;
  if (!want || typeof pin !== "string") return false;
  const h = s => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(h(pin), h(want));
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

async function readState() {
  const [text, rev] = await redis(["MGET", KEY, REV]);
  let state = null;
  try { state = text ? JSON.parse(text) : null; } catch (e) {}
  return { state, rev: Number(rev) || 0 };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!DB_URL || !DB_TOKEN) return res.status(500).json({ error: "Database is not connected" });
  try {
    if (req.method === "GET") return res.status(200).json(await readState());

    if (req.method === "POST") {
      const failKey = "badminton:fails:" + clientIp(req);
      const fails = Number(await redis(["GET", failKey])) || 0;
      if (fails >= MAX_FAILS) return res.status(429).json({ error: "Too many wrong PINs. Wait 15 minutes" });
      if (!pinOk(req.headers["x-pin"])) {
        await redis(["INCR", failKey]);
        await redis(["EXPIRE", failKey, FAIL_WINDOW]);
        return res.status(401).json({ error: "Wrong PIN" });
      }

      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: "Bad JSON" }); }
      }
      if (!body || !body.state || typeof body.state !== "object") return res.status(400).json({ error: "No state" });
      const baseRev = Number(body.baseRev);
      if (!Number.isInteger(baseRev) || baseRev < 0) return res.status(400).json({ error: "No revision" });
      const text = JSON.stringify(body.state);
      if (text.length > 200000) return res.status(413).json({ error: "Too big" });

      const [ok, rev] = await redis(["EVAL", SAVE, "2", KEY, REV, String(baseRev), text]);
      if (!ok) return res.status(409).json({ error: "Newer data on the server", ...(await readState()) });
      return res.status(200).json({ ok: true, rev });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Server error" });
  }
};
