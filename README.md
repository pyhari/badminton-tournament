# Badminton Tournament

A one-page app to run a one-day badminton tournament: 8 teams of 3, two groups of 4, then IPL-style playoffs ("Champions League" for the top two of each group, "FPL" for the rest). Each tie has 3 games to 15 points: men's doubles and two mixed doubles.

- `/`: organizer page. Set up teams, draw the groups, and enter scores.
- `/watch`: player page. It is read-only, updates every 15 seconds, and shows each player their next match and court.

## Files

- `index.html`: the whole app, with no build step.
- `api/state.js`: a Vercel function that stores the tournament in Upstash Redis. Anyone can read it. Saving needs the admin PIN.
- `vercel.json`: sends `/watch` to `index.html`.

## Setup on Vercel

1. Deploy the repo to Vercel. No framework or build command is needed.
2. In the project, open **Storage** and connect an **Upstash for Redis** database. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or the `UPSTASH_REDIS_REST_*` equivalents.
3. Under **Settings → Environment Variables**, add `ADMIN_PIN` with a long PIN.
4. Redeploy so the new variables take effect.
5. Under **Settings → Deployment Protection**, check that players can open the production URL without a Vercel login.

## On the day

- On the organizer phone, open `/`, enter the admin PIN under **Live link for players**, and press **Connect**.
- Share the `/watch` link with players.
- Scores are saved on the phone and sent to the server about 1.5 seconds after each change. Failed sends retry by themselves.
- Each save carries a revision number. If another device has saved newer data, you are asked whether to load the server copy or replace it. A new device never overwrites the server without asking.
- After 10 wrong PINs from one address, saving is blocked for 15 minutes.
