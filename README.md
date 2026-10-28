# Badminton Tournament

A one-page app to run a one-day badminton tournament: 8 teams of 3, two groups of 4, then IPL-style playoffs ("Champions League" for the top two of each group, "FPL" for the rest). Each match (team v team) has 3 games to 15 points: men's doubles and two mixed doubles.

- `/`: organizer page. Set up teams, draw the groups, and enter scores.
- `/watch`: player page. It is read-only, updates every 3 seconds, and shows each player their next match and court.

## Files

- `src/lib/engine.js`: the tournament rules (draws, fixtures, scoring, tables, playoffs), with tests in `engine.test.js`.
- `src/lib/store.js`: saving on the device, server sync, organizer login.
- `src/screens/`, `src/components/`: the React screens (Setup, Matches, Tables, Playoffs, Me, Login).
- `api/generate.js`: a Vercel function that asks Claude to turn a description into a tournament format (schema in `api/_tournament-schema.json`). Organizer only.
- `src/lib/format.js`: checks a tournament format, works out its fixtures and timing, and describes it, with tests in `format.test.js`.
- `api/state.js`: a Vercel function that stores the tournament in Upstash Redis. Anyone can read it. Saving needs the admin PIN.
- `vercel.json`: builds with Vite, sends `/watch` to the app and sets cache headers.
- `public/sw.js`: keeps the app (not the scores) on each phone, so it opens at once and works with a weak signal. `public/manifest*.webmanifest`: lets players add the app to their home screen.

## Development

```
npm install
npm run dev     # http://127.0.0.1:5173, choose "Local test mode"
npm test        # engine tests
npm run build   # production build in dist/
```

## Speed

- Players' phones check for new scores every 3 seconds. Vercel's edge answers those checks from a copy at most a second old, so the database is read about once a second however many phones are watching. The organizer always reads the database directly (`/api/state?fresh=1`).
- Everything the organizer does is saved on the phone first, so taps never wait for the network.
- Fonts are bundled with the app. Setup, the team draw and the test tools load only for the organizer.
- After the first visit the app opens from the phone's cache, even offline. After a deploy, phones get the new version on their next visit.

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
2. **Who wins**: Random, Favourites (stronger team wins 8 in 10), Upsets, or Tight (every match 2–1). Or pick one team to win every match it plays.
3. **Play**: a few matches (one per court), the group stage, or to the end. **Rerun whole tournament** clears scores and plays again, for a new result each tap.
4. **Scenarios**: three teams level in Group A, to check the tiebreakers.

Each run is added to a run log showing the group tables, both playoff brackets and the champions. `npm test` also plays 200 random tournaments and checks every playoff pairing.

## AI recaps and story (players' page)

**Preview and local builds only, for now:** `api/insights.mjs` is off when `VERCEL_ENV` is `production`, and the app hides these features in production builds (`AI_INSIGHTS` in `src/lib/insightsFeed.js`).

On `/watch`, finished matches get a tag (Upset, Comeback, 18–16 thriller, Clean sweep) and a 1–2 sentence recap. A **Story so far** card shows champions, up to 3 highlight cards (upset, thriller, comeback or sweep, each with teams, score and the key fact) and the group race (which teams are certain of the Champions League or FPL). The app draws all of that from the scores; Claude adds only the headline, one line and a caption per card.
- **Race for the Champions League** (Tables on `/watch`, while a group is unfinished): each team's chance of a top-2 place. `top2Odds` in `src/lib/insights.js` plays the remaining group matches 2,000 times, the stronger team (by player levels) winning more often, with a fixed seed so every phone shows the same numbers. Claude adds a one-line reason per team from its record and remaining opponents; reasons are hidden while they are out of date.

- `src/lib/insights.js` works out the facts from the scores: upsets (a win by a team at least 2 levels weaker), comebacks, extra-points games, and who is certainly through or out of the top 2. Claude (`api/insights.mjs`, Opus 5.5 at low effort, structured outputs) only writes them up, so it can't invent scores.
- Players never trigger AI directly. When results change, the next player request starts one background write (at most one every 45 seconds); the words are saved in Redis and shared from Vercel's edge, so any number of players costs the same. A tournament day is a few dozen calls, well under $1.
- A corrected score hides that match's old recap until a new one is written. If a write fails (for example no credit), it waits 5 minutes before trying again.
- Needs `ANTHROPIC_API_KEY`. Its own switch is `INSIGHTS_ON` in `api/insights.mjs`, separate from the AI planner.

## AI format planner (turned off)

**Turned off for now:** the AI tab is hidden and `/api/generate` answers 503. To turn it back on, set `AI_ON` to `true` in `src/screens/TestTools.jsx` and `api/generate.js`.


**Setup → AI** turns a description such as "12 teams of 2 men and 1 woman, 3 groups, top 2 into a knockout, games to 21, 5 courts from 8:30" into a tournament format, using Claude Opus 5.5 with structured outputs.

- The app checks the format and shows what can't work (for example an IPL bracket without exactly 4 teams), what to check (uneven groups, not enough players ticked), and the assumptions Claude made. It lists the fixtures and estimates the finish time from the number of courts and minutes per game.
- Teams, groups, courts, points and timing can be adjusted, and drafts are saved on the device.
- **It doesn't change the current tournament.** Running a new format in the app is the next step; the running tournament still uses the club format.
- Only the organizer can call it (the admin PIN is checked), because each call costs a few cents. If Claude declines a request, the API retries it on Anthropic's recommended fallback model.
- Setup: add `ANTHROPIC_API_KEY` in Vercel (Preview first) and redeploy. Like the test tools, it shows on preview and local builds, and on the live site only with `?ai=1`. Local test mode has no server, so it offers sample formats instead.

## Setting up teams and groups

The **Setup** tab has three steps: Players, Teams and Groups. **More** holds the number of courts, the live link, backup and log out.

1. **Players.** Tick who is playing (16 men and 8 women) and give each player a level from 1 to 5, with 5 the strongest. The page says how many to tick or untick.
2. **Teams.** **Draw balanced teams** puts the stronger half of the men in Pot 1 (Man 1) and the rest in Pot 2 (Man 2), then gives each team one man from each pot and one woman. It keeps team strengths (the sum of levels) as even as possible. To adjust, tap two players to swap them, or tap a player and then a reserve to sub the reserve in. **Lock teams** checks for empty slots, duplicates and players not marked as playing.
3. **Group draw.** Teams are ranked by strength into 4 pots of 2. Each pot sends one team to each group, so the two strongest teams start in different groups. Draw one team at a time or all at once. **Redo draw** clears the groups and all scores.

## On the day

- There are no rounds or fixed times. When a court is free, open any match that is ready on the Matches tab and tap the court it goes to. It moves to **On court now**, and those players see their court on their phones. Playoff ties become ready once their teams are known.

- On the organizer phone, open `/` and log in with the admin PIN. The server checks it, so this needs Upstash and `ADMIN_PIN` set up. The phone stays logged in until **Log out**, even if the server goes down later. Anyone else who opens `/` sees only the login card and a link to live scores.
- For testing on your own computer, run `npm run dev`, open `http://127.0.0.1:5173/` and choose **Local test mode**. Nothing is sent to a server, and `/watch` shows the tournament saved on that computer.
- Share the `/watch` link with players.
- Scores are saved on the phone and sent to the server under half a second after each change, so players see them within about 3 seconds. Failed sends retry by themselves.
- Each save carries a revision number. If another device has saved newer data, you are asked whether to load the server copy or replace it. A new device never overwrites the server without asking.
- After 10 wrong PINs from one address, saving is blocked for 15 minutes.
