<p align="right">
  <a href="README.ru.md">Русская версия</a>
</p>

Do you want to play games while scouting? Do you like Kahoot?

**Project Peardict** is a Kahoot-style FRC scouting platform:
- Before each match, users pick which alliance/team they think will win.
- If the pick is correct, the user earns points.
- If the pick is wrong, they lose nothing.

--- 

## What this repo contains:
This repository currently contains:
- Static HTML frontend pages (`index.html`, `app.html`)
- A modern, polished UI using custom CSS and variables
- Direct integration logic with Supabase Auth and Database

---

## Very brief technical overview

- Load users, leaderboards, and matches natively via the `supabase-js` client communicating with a PostgreSQL database.
- Frontend reads match/user state via `supabase.from()` calls and submits picks directly to the backend.
- Authentication is handled by Supabase because I'm lazy. Also, email is handled via the supabase auth engine which limits us to 4 an hour, but the email verification doesn't actually check if you've verified your email so you can just sign up. Will fix at some point.

---

## Notes
- Login and signups are handled beautifully in the root `index.html`. :3
- The actual game interactions, matches, and leaderboard sit in `app.html`.

## Disclaimer

Project Peardict does not involve real gambling or bets. This platform is purely a quiz/game system:
 - Users pick which alliance/team will win, and points are awarded only for correct guesses.
 - There is no fake currency or anything involved.
