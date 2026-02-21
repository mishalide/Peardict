Project Peardict is a fully cloud hosted (free!) FRC "prediction system". 

Do you want to play games while scouting? Do you take an issue with these pesky prediction markets which are just poorly disguised gambling? Well fear no more for Project Peardict is here!

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

