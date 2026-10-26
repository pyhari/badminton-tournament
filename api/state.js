// Stores the tournament state in an Upstash Redis database.
// Anyone can read. Only a request with the right PIN can write.
const DB_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const DB_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const KEY = "badminton:state";

async function redis(cmd) {
  const r = await fetch(DB_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + DB_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd)
  });
  return r.json();
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!DB_URL || !DB_TOKEN) return res.status(500).json({ error: "Database is not connected" });
  try {
    if (req.method === "GET") {
      const out = await redis(["GET", KEY]);
      let state = null;
      try { state = out.result ? JSON.parse(out.result) : null; } catch (e) {}
      return res.status(200).json({ state });
    }
    if (req.method === "POST") {
      const pin = req.headers["x-pin"];
      if (!process.env.ADMIN_PIN || pin !== process.env.ADMIN_PIN) return res.status(401).json({ error: "Wrong PIN" });
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || !body.state) return res.status(400).json({ error: "No state" });
      const text = JSON.stringify(body.state);
      if (text.length > 200000) return res.status(413).json({ error: "Too big" });
      await redis(["SET", KEY, text]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
};
