# Predix ora — local setup

This site now has a local Node server for API-Football fixture and score data. It does not generate predictions, connect PredictZ/Forebet/OMP, collect payments, or unlock VIP access.

## Start without credentials

Use Node.js 22.10 or newer. There are no third-party dependencies and no npm install step.

On this Windows computer, double-click `start-local.cmd` in the project folder. It uses Node on PATH or the bundled Codex Node runtime. Keep its console open while using the site. No package install is needed. If it reports an old Node version, use Node.js 22.10 or newer.

Alternatively, in Git Bash:

```sh
cd /c/Users/user/my-first-project
node --env-file-if-exists=.env server.mjs
```

Open http://127.0.0.1:3000 in Chrome. The fixture section will show **Setup required** until a valid key is configured. Stop with Ctrl+C. Opening index.html directly still allows the static preview, but cannot use the backend.

## Add your key privately

1. In your API-Football/API-Sports dashboard, find **Account → My Access**. This adapter uses the direct API-Sports key, not a RapidAPI subscription key.
2. In VS Code, copy `.env.example` to a new file named exactly `.env` in this project. If `.env` already exists, edit it rather than overwriting it.
3. In that local file only, put your key after `API_FOOTBALL_KEY=`. Save it. Do not paste the key into chat, browser JavaScript, screenshots, Git or documentation.
4. Restart `node --env-file-if-exists=.env server.mjs` and refresh Chrome. A successful response will show a fetched-at time and provider fixtures (or an explicit empty response). Authentication, quota and connectivity failures have separate visible messages.

`.env` is Git-ignored. The server serves only four public files and the fixtures endpoint; it does not serve credentials, backups or its own source. No key is included in logs or API responses. If a key is exposed, revoke it in the provider dashboard.

## Polling and quota

- Default: one `/fixtures?date=YYYY-MM-DD&timezone=UTC` response for the current UTC date. It includes scores/status alongside upcoming fixtures. There is no second live request. The page's In progress filter is local.
- Shared upstream cooldown: 900 seconds (15 minutes). This is periodic score updating, **not instant real-time delivery**.
- Maximum: 90 total upstream attempts per rolling 24 hours, including failures. This reserves 10 of the documented 100 free daily requests for other use. Other apps/account activity may consume that allowance too; provider quota headers and errors can pause requests sooner.
- Cache, cooldown and attempt timestamps persist in `.cache/fixtures.json` across restarts and mode/date changes. Do not delete this cache to force refreshes. Run only one server instance for this project/account; multi-instance deployment needs a shared budget store.
- Browsers check the local service once a minute while visible. Concurrent tabs share one in-flight request and cached response; manual checks cannot bypass cooldown or budget. No visitors means no upstream polling.
- `FIXTURE_MODE=live` switches the single upstream request to `/fixtures?live=all` for in-progress matches only (including those started on another date). It does not add a second request stream. Restart after config changes.
- `FIXTURE_POLL_SECONDS` can be lowered to 60 only after checking the account quota. A continuous 60-second stream would require 1,440 calls/day. `FIXTURE_REQUEST_BUDGET` defaults to 90; raise it only to a budget supported by the actual plan. The app never upgrades or buys a plan.
- Provider 429 errors, exhausted daily quota and network failures back off; no immediate retry loop. Stale data retains its original fetch time. Snapshots older than 24 hours are hidden by the server.
- Today's feed uses UTC dates, clearly labelled. Kickoff times display in the browser's local timezone. Around midnight a previous date can remain visible briefly, labelled stale. The today mode can exclude a match that kicked off the previous UTC day; live mode covers that use case.

## Coverage and limitations

Provider coverage varies by league/season and may be delayed or missing. Empty results do not prove that no matches exist worldwide. Confirm your target competitions and current season in the provider dashboard/Live Tester and `/leagues` coverage before relying on this service. The adapter refuses unexpectedly paginated fixture responses rather than silently presenting incomplete data.

No live API response has been verified: no real credentials were supplied during development. Tests use fabricated responses. Provider match data never fills the free consensus list, which still requires verified matching fixture, market and outcome across PredictZ, Forebet and OMP (one million prediction by Dumebi The Creator).

Prices remain: free KES 0; VIP KES 1,500/month; 5 odds KES 100; 10 odds KES 500; 100 odds KES 700. Payments remain inactive pending merchant eligibility and integration. Predictions and source agreement do not guarantee wins.

This server binds to 127.0.0.1 only. It is a local development setup, not public hosting. Deployment, production authentication, HTTPS, a shared quota store and approved payments are separate work.

## Check the implementation

```sh
node --test tests/server.test.mjs tests/live-ui.test.mjs tests/regression.test.cjs
```

Tests cover provider normalization/errors, concurrent caching, persistent quotas, stale and empty responses, private-file restrictions, frontend states and filters, and retained pricing/demo interactions. They do not establish live provider coverage or real account access.

## Official references checked during implementation

- https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide
- https://www.api-football.com/documentation-v3
- https://www.api-football.com/pricing

The official guide documents direct `x-apisports-key` authentication, fixture date/live modes, 100 free daily requests, quota headers, HTTP-200 error payloads and league-season coverage limitations. Verify your actual account limits before increasing polling frequency.
