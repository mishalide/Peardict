<p align="right">
  <a href="README.ru.md">Русская версия</a>
</p>

Do you want to play games while scouting? Do like Kahoot? 

**Project Peardict** is a Kahoot-style FRC scouting platform:
- Before each match, users pick which alliance/team they think will win.
- If the pick is correct, the user earns points.
- If the pick is wrong, they lose nothing.

--- 

## What this repo contains:
This repository currently contains:
- A cloudflare worker backend (`cloudflare_workers/fujo-worker.js`)
- Google Apps Scripts integration scripts (`appscripts/*.js`)
- Static HTML frontend pages (`login.html`, `index.html`)

---

## Very brief technical overview

- Load users and matches via a serverless function (Cloudflare Worker) that reads Google Sheets data and calls a Google Apps Script layer for writes.
- Frontend reads match/user state via `GET` APIs and submits picks via `POST`.
- Google Sheets acts as a simple and accessible Database

---

## API surfaces used by frontend

- `GET /api/users`
- `GET /api/matches`
- `GET /api/users/:user_id/bets` 
- `POST /api/bets`
*quick disclaimer no bets are being made; this is just recycling an old API that I made; we disavow gambling and prediction market style platforms*

---

## tech stack (current)

### Frontend
- Static HTML/CSS/Javascript pages
- Google Fonts (Orbitron, Share Tech Mono)
- No React/Vite/Tailwind is present in this repository YET

### Backend
- Cloudflare Workers (Javascript)
- Google Apps Script bridge for write operations

### Data Storage
- Google Sheets 

---


## Supabase backend setup (new)

This repo now includes a Supabase-first backend path for the Cloudflare Worker in `cloudflare_workers/fujo-worker.js`.

### 1) Create your Supabase schema
- Run the migration file in your Supabase SQL editor:
  - `supabase/migrations/202603030001_init_peardict.sql`
- This creates `users`, `matches`, `bets`, `win_predictions`, plus an atomic `place_bet(...)` SQL function used by the worker.

### 2) Configure Worker secrets
Set these in your Worker environment (Wrangler secret/env):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

If you keep the placeholder constants in local code, replace them before deploying.

### 3) Seed data
- Insert initial rows into `users` and `matches` in Supabase.
- Existing frontend API contracts remain the same:
  - `GET /api/users`
  - `GET /api/matches`
  - `GET /api/users/:user_id/bets`
  - `POST /api/bets`
  - `GET /api/leaderboard`

### 4) Deploy
- Deploy your Cloudflare worker as usual after setting secrets and updating placeholders.

### 5) Keep `matches` synced from The Blue Alliance (no Google Sheets)
A second migration is included to sync TBA match data directly into Postgres:
- `supabase/migrations/202603030002_tba_sync.sql`

It adds:
- `tba_sync_config` table (stores your event code)
- `sync_tba_matches()` SQL function (calls TBA via `pg_net` and upserts into `matches`)
- `schedule_tba_sync_every_5m()` SQL function (uses `pg_cron` every 5 minutes)

Setup after running migration:
- Store your TBA key in Supabase Vault:
  - `select vault.create_secret('YOUR_TBA_AUTH_KEY', 'tba_auth_key');`
- Set your event code:
  - `update public.tba_sync_config set event_code = '2025txdri' where id = true;`
- Schedule the sync:
  - `select public.schedule_tba_sync_every_5m();`
- Run once manually if needed:
  - `select public.sync_tba_matches();`

## Notes
- The quiz dashboard docs are in `cloudflare_page/README.md`.
- Read `setup.md` for instructions on how to run this yourself.
- Login is handled by `login.html` but at the moment this is **PURELY DECORATIVE**
- Please review `license.md` before use.

## disclaimer

Project Peardict does not involve real gambling or bets. While it reuses backend APIs from a discontinued mock-gambling app (Project FUJO), this platform is purely a quiz/game system:
 - Users pick which alliance/team will win, and points are awarded only for correct guesses.
 - There is no fake currency or anything involved

## Some UI Samples
<img width="1919" height="1199" alt="image" src="https://github.com/user-attachments/assets/617cd48a-9d4c-4fe5-b384-35233090f473" />
*some elements subject to change*

