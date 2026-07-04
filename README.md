# The Weird Side of YouTube

**Live at [weirdtube.wtf](https://weirdtube.wtf)** — hit one button and get a random strange, surreal, or hilarious YouTube video. Endlessly.

This is a modernized, self-hosted fork of the original [RCOS](https://rcos.io/) project by members of Alpha Chi Rho at Rensselaer Polytechnic Institute. The stack has been brought up to date and the site is deployed self-hosted behind a Cloudflare Tunnel.

## Features

- **Get Weird** — one click serves a random video and autoplays continuously. Each visitor's session never repeats a video until the whole catalog has been seen, then it cycles fresh.
- **Public submissions** — anyone can suggest a video *or* a whole playlist at [`/submit`](https://weirdtube.wtf/submit). Submissions are protected by a Cloudflare Turnstile captcha, per-IP rate limiting, and a honeypot, and land in an admin **moderation queue** — nothing goes live until an admin approves it.
- **Admin panel** — add/remove videos, moderate submissions (approve expands playlists via the YouTube API), and view watch history.
- **Shareable deep links** — the share button copies a `weirdtube.wtf/?v=<id>` link (or opens the native share sheet on mobile) that replays that specific video first.
- **Discoverable** — `robots.txt`, `sitemap.xml`, and Open Graph / Twitter share cards.

## Tech stack

- **Node.js 22** · **Express 4** · **EJS 3** templating
- **MongoDB 7** · **Mongoose 8**
- **Passport** session auth (sessions persisted in MongoDB via `connect-mongo`)
- **csrf-csrf** (CSRF), **helmet**, **express-rate-limit**, **Cloudflare Turnstile**
- **webpack 5** bundles the vanilla-JS frontend (no jQuery); **PureCSS** for layout
- **Docker Compose** (app + mongo), served publicly via a **Cloudflare Tunnel**

## Running it locally

> For a full from-scratch walkthrough on a brand-new machine — installing WSL2 /
> Docker / Git, getting a YouTube API key, migrating the database, and deploying
> publicly with a Cloudflare Tunnel — see **[SETUP.md](SETUP.md)**.

Requires **Docker Desktop** and a **YouTube Data API v3** key.

```bash
# 1. Configure environment
cp .env.example .env
#    then edit .env — add your YOUTUBE_API_KEY and generate secrets:
#    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 2. Build and start (app on http://localhost:3000, mongo on 127.0.0.1:27017)
docker compose up -d --build

# 3. Create an admin account (registration is intentionally disabled)
docker compose exec app node tools/create_admin_auto.js <username> <password>

# 4. Seed some videos (from InitialSources.csv), or add your own
docker compose exec app node tools/import_csv.js
docker compose exec app node tools/add_video.js <youtube-url-or-id>
docker compose exec app node tools/add_playlist.js <playlist-url>

# 5. Run the tests
docker compose exec app npm test
```

Optional: set `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` in `.env` for real captcha protection on the submission form. Without them, Cloudflare's always-pass test keys are used so the form still works in development.

For public deployment the app is fronted by a **Cloudflare Tunnel** (`cloudflared` → `localhost:3000`); both container ports are bound to `127.0.0.1` so the origin isn't exposed on the LAN or internet.

## Project layout

- `app.js` — Express entry point / middleware wiring
- `config/` — db, CSRF, and Turnstile configuration
- `router/` — route definitions (`root`, `admin`, `api`)
- `controllers/` — request handlers (video API, admin, submissions, reddit crawler)
- `models/` — Mongoose schemas (video, account, submission, history, …)
- `views/` — EJS templates
- `frontend/` — browser JS bundled by webpack into `dist/`
- `public/` — static assets (CSS, favicon, robots, sitemap)
- `tools/` — CLI scripts (backups, admin creation, video/playlist import, maintenance)
- `test/` — mocha unit tests

## Contributing

Issues and pull requests welcome. If you spot a bug or something worth improving, open an [issue](https://github.com/jacobjiggler/WeirdSideofYouTubeFork/issues) or send a PR.

## Credits & license

Originally created by the RCOS team (Mike Metrocavich, Colin Atkinson, Jacob Lane, Nathan Siviy, YoungChul Chun, James Lee, and past contributors), in memory of Michael Metrocavich. Licensed under the MIT License — see the [`LICENSE`](LICENSE) file.
