# Setup guide — from scratch on a new machine

This walks you from a blank machine to a running instance, and (optionally) to a
publicly deployed site at your own domain. It's written for **Windows 11 with
Docker Desktop (WSL2 backend)** — the environment the live site runs on — but the
Docker parts work the same on macOS/Linux.

- [1. Prerequisites](#1-prerequisites)
- [2. Get the code](#2-get-the-code)
- [3. YouTube Data API key](#3-youtube-data-api-key)
- [4. Environment file](#4-environment-file)
- [5. Build and run](#5-build-and-run)
- [6. Create an admin + add videos](#6-create-an-admin--add-videos)
- [7. Migrating an existing site (restore the DB)](#7-migrating-an-existing-site-restore-the-db)
- [8. Publish it with a Cloudflare Tunnel](#8-publish-it-with-a-cloudflare-tunnel)
- [9. Optional: real Turnstile keys](#9-optional-real-turnstile-keys)
- [10. Day-to-day operations](#10-day-to-day-operations)
- [11. Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

Install these once on the new machine.

**a. WSL2** (Windows only) — open PowerShell **as Administrator**:
```powershell
wsl --install
```
Reboot when prompted.

**b. Docker Desktop** — download from <https://www.docker.com/products/docker-desktop/>,
install, and in **Settings → General** make sure **"Use the WSL 2 based engine"** is
enabled. Start Docker Desktop and leave it running. Verify:
```powershell
docker --version
docker compose version
```

**c. Git** — <https://git-scm.com/download/win> (or `winget install --id Git.Git`). Verify:
```powershell
git --version
```

## 2. Get the code

```powershell
git clone https://github.com/jacobjiggler/WeirdSideofYouTubeFork.git
cd WeirdSideofYouTubeFork
```

## 3. YouTube Data API key

The app calls the YouTube Data API to fetch video titles and expand playlists.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or pick one).
3. **APIs & Services → Library →** search **"YouTube Data API v3" → Enable**.
4. **APIs & Services → Credentials → Create credentials → API key**.
5. Copy the key. (Optionally restrict it to the YouTube Data API v3.)

## 4. Environment file

Copy the template and fill it in:
```powershell
Copy-Item .env.example .env
```
Generate two strong random secrets:
```powershell
docker run --rm node:22-alpine node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Run it twice and put the values in `.env`:
```
YOUTUBE_API_KEY=your_key_from_step_3
SESSION_SECRET=first_random_value
COOKIE_SECRET=second_random_value
# TURNSTILE_* can stay blank for now (test keys are used until you set real ones)
```
`.env` is gitignored — never commit it.

## 5. Build and run

```powershell
docker compose up -d --build
```
This builds the app image (Node 22, non-root), starts MongoDB 7, and runs the app.
Both ports are bound to `127.0.0.1` only. Check it:
```powershell
docker compose ps
curl http://localhost:3000        # should return the home page HTML
docker compose logs app --tail=20 # should show "Express server listening on port 3000"
```
Open <http://localhost:3000> in a browser.

Run the tests to confirm a healthy build:
```powershell
docker compose exec app npm test
```

## 6. Create an admin + add videos

Registration is intentionally disabled, so create the admin from the CLI:
```powershell
docker compose exec app node tools/create_admin_auto.js <username> <password>
```
Then seed the catalog (starter list), or add your own:
```powershell
docker compose exec app node tools/import_csv.js                 # from InitialSources.csv
docker compose exec app node tools/add_video.js <youtube-url>    # one video
docker compose exec app node tools/add_playlist.js <playlist-url> # a whole playlist
```
Log in at `/login`, then use **Admin Panel** to manage videos and **Submissions**
to moderate public suggestions.

## 7. Migrating an existing site (restore the DB)

If you're moving an existing instance to this machine and want your videos,
history, and accounts, copy your latest backup `.gz` into `./backups/` and restore:
```powershell
# copy backups\weirdtube_YYYY-MM-DD_HHMMSS.gz into ./backups first, then:
powershell -ExecutionPolicy Bypass -File tools\restore_db.ps1
```
It uses the most recent backup in `./backups` (or pass `-ArchivePath <file>`) and
replaces the DB contents. You then don't need step 6 — your admin and videos come
back with the restore.

Make a backup any time with:
```powershell
powershell -ExecutionPolicy Bypass -File tools\backup_db.ps1
```

## 8. Publish it with a Cloudflare Tunnel

The live site is exposed with a **Cloudflare Tunnel** — no open inbound ports, no
port forwarding. You need a domain on a Cloudflare account.

**a. Install cloudflared:**
```powershell
winget install --id Cloudflare.cloudflared
```

**b. Authenticate** (opens a browser to pick your domain/zone):
```powershell
cloudflared tunnel login
```

**c. Create a tunnel** (writes a credentials `.json`):
```powershell
cloudflared tunnel create weirdtube
```

**d. Configure it** — create `%USERPROFILE%\.cloudflared\config.yml`:
```yaml
tunnel: <TUNNEL-ID-from-step-c>
credentials-file: C:\Users\<you>\.cloudflared\<TUNNEL-ID>.json
ingress:
  - hostname: your-domain.com
    service: http://localhost:3000
  - service: http_status:404
```

**e. Point DNS at the tunnel:**
```powershell
cloudflared tunnel route dns weirdtube your-domain.com
```

**f. Test it in the foreground:**
```powershell
cloudflared tunnel run weirdtube
```
Visit `https://your-domain.com` — you should see the site. Ctrl+C to stop.

**g. Run it as a service** so it survives reboots. On Windows the service runs as
`SYSTEM`, which reads config from
`C:\Windows\System32\config\systemprofile\.cloudflared\`:
```powershell
# copy your config + credentials into the SYSTEM profile, then install (run as Admin):
cloudflared service install
```
> ⚠️ After install, confirm the service command actually runs the tunnel — see the
> troubleshooting note below. Verify with `Get-Service cloudflared` and by rebooting.

## 9. Optional: real Turnstile keys

The `/submit` form uses Cloudflare Turnstile. Until you set real keys it uses
Cloudflare's always-pass **test** keys (fine for dev, no real protection).

1. Cloudflare dashboard → **Turnstile → Add widget**, hostname = your domain, mode **Managed**.
2. Put the keys in `.env`:
   ```
   TURNSTILE_SITE_KEY=0x...
   TURNSTILE_SECRET_KEY=0x...
   ```
3. Recreate the app: `docker compose up -d`.

## 10. Day-to-day operations

```powershell
docker compose up -d --build      # apply code/dependency changes (see gotcha below)
docker compose restart app        # apply template/CSS/controller edits (no dep change)
docker compose logs app -f        # tail logs
docker compose exec app npm test  # run tests

powershell -ExecutionPolicy Bypass -File tools\backup_db.ps1   # back up the DB
docker compose exec app node tools/check_private.js            # audit for dead videos
docker compose exec app node tools/cleanup_videos.js --apply   # prune dead videos
```

## 11. Troubleshooting

**`sh: webpack: not found` / app crash-loops after `docker compose exec app npm install`.**
The container runs with `NODE_ENV=production`, so `npm install` inside it prunes
devDependencies (including webpack). Fix by rebuilding fresh:
```powershell
docker compose up -d --build --renew-anon-volumes
```
`--renew-anon-volumes` repopulates the `node_modules` volume from the freshly built
image. It does **not** touch the `mongo_data` volume — your DB is safe. (Never use
`docker compose down -v`; that would delete the database.)

**A CSS/JS change isn't showing up on the live site.**
Cloudflare caches static assets at the edge (~4h). Either purge the cache in the
Cloudflare dashboard, or toggle **Development Mode** on while iterating.

**The cloudflared service is installed but the site is down after reboot.**
The Windows service must actually *run the tunnel*. Check its command:
```powershell
sc.exe qc cloudflared
```
The binary path should include `tunnel run` (or `tunnel run <name>`). If it's just
`cloudflared.exe`, reinstall: `cloudflared service uninstall` then `cloudflared
service install`, and make sure `config.yml` + the credentials `.json` are in
`C:\Windows\System32\config\systemprofile\.cloudflared\`.

**"Form expired or invalid (CSRF)."**
Usually a stale `_csrf` cookie. It self-heals on reload of the form page; if a
CSS/JS change was involved, purge the Cloudflare cache too.

**Mongo won't start / data looks empty.**
Check `docker compose logs mongo`. The data lives in the named `mongo_data` volume;
if you recreated it, restore from a backup (step 7).
