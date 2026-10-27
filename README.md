# Badminton Tournament

A one-page app to run a one-day badminton tournament: 8 teams of 3, two groups of 4, then IPL-style playoffs ("Champions League" for the top two of each group, "FPL" for the rest). Each tie has 3 games to 15 points: men's doubles and two mixed doubles.

- `/`: organizer page. Set up teams, draw the groups, and enter scores.
- `/watch`: player page. It is read-only, updates every 15 seconds, and shows each player their next match and court.

## Files

- `src/lib/engine.js`: the tournament rules (draws, fixtures, scoring, tables, playoffs), with tests in `engine.test.js`.
- `src/lib/store.js`: saving on the device, server sync, organizer login.
- `src/screens/`, `src/components/`: the React screens (Setup, Matches, Tables, Playoffs, Me, Login).
- `api/state.js`: a Vercel function that stores the tournament in Upstash Redis. Anyone can read it. Saving needs the admin PIN.
- `vercel.json`: builds with Vite and sends `/watch` to the app.

## Development

```
npm install
npm run dev     # http://127.0.0.1:5173, choose "Local test mode"
npm test        # engine tests
npm run build   # production build in dist/
```

## Setup on Vercel

1. Deploy the repo to Vercel. `vercel.json` sets the Vite build, so no settings are needed.
2. In the project, open **Storage** and connect an **Upstash for Redis** database. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or the `UPSTASH_REDIS_REST_*` equivalents.
3. Under **Settings → Environment Variables**, add `ADMIN_PIN` with a long PIN.
4. Redeploy so the new variables take effect.
5. Under **Settings → Deployment Protection**, check that players can open the production URL without a Vercel login.

## Production and preview

- `main` deploys to production. Any other branch (for example `dev`) deploys to a preview link, which only Vercel team members can open.
- Preview deployments save under `badminton:preview:…` in Redis, so testing never changes the live tournament. Production uses `badminton:state` and `badminton:rev`.
- `ADMIN_PIN` can be set separately for Production and Preview in the Vercel environment variable settings. The Upstash variables must be available to both.
- Workflow: push to `dev`, test on the preview link, then merge `dev` into `main` to go live.

## Testing a whole tournament

On preview and local builds, **Setup → Test** has tools to play the tournament through quickly. They are hidden on the live site (add `?test=1` to the URL to show them there, with a warning).

1. **Quick setup** draws balanced teams and the groups in one tap.
2. **Who wins**: Random, Favourites (stronger team wins 8 in 10), Upsets, or Tight (every tie 2–1). Or pick one team to win every tie it plays.
3. **Play**: a few ties (one per court), the group stage, or to the end. **Rerun whole tournament** clears scores and plays again, for a new result each tap.
4. **Scenarios**: a three-way tie in Group A to check the tiebreakers.

Each run is added to a run log showing the group tables, both playoff brackets and the champions. `npm test` also plays 200 random tournaments and checks every playoff pairing.

## Setting up teams and groups

The **Setup** tab has three steps: Players, Teams and Groups. **More** holds the number of courts, the live link, backup and log out.

1. **Players.** Tick who is playing (16 men and 8 women) and give each player a level from 1 to 5, with 5 the strongest. The page says how many to tick or untick.
2. **Teams.** **Draw balanced teams** puts the stronger half of the men in Pot 1 (Man 1) and the rest in Pot 2 (Man 2), then gives each team one man from each pot and one woman. It keeps team strengths (the sum of levels) as even as possible. To adjust, tap two players to swap them, or tap a player and then a reserve to sub the reserve in. **Lock teams** checks for empty slots, duplicates and players not marked as playing.
3. **Group draw.** Teams are ranked by strength into 4 pots of 2. Each pot sends one team to each group, so the two strongest teams start in different groups. Draw one team at a time or all at once. **Redo draw** clears the groups and all scores.

## On the day

- There are no rounds or fixed times. When a court is free, open any tie that is ready on the Matches tab and tap the court it goes to. It moves to **On court now**, and those players see their court on their phones. Playoff ties become ready once their teams are known.

- On the organizer phone, open `/` and log in with the admin PIN. The server checks it, so this needs Upstash and `ADMIN_PIN` set up. The phone stays logged in until **Log out**, even if the server goes down later. Anyone else who opens `/` sees only the login card and a link to live scores.
- For testing on your own computer, run `npm run dev`, open `http://127.0.0.1:5173/` and choose **Local test mode**. Nothing is sent to a server, and `/watch` shows the tournament saved on that computer.
- Share the `/watch` link with players.
- Scores are saved on the phone and sent to the server about 1.5 seconds after each change. Failed sends retry by themselves.
- Each save carries a revision number. If another device has saved newer data, you are asked whether to load the server copy or replace it. A new device never overwrites the server without asking.
- After 10 wrong PINs from one address, saving is blocked for 15 minutes.
