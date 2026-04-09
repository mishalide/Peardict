## disclaimer

This dashboard does not involve real gambling. It reuses the backend APIs from the discontinued Project FUJO, which was originally a mock gambling app. In this quiz mode:
- All stakes are **0**
- Users earn points for selecting the correct answers, similar to Kahoot or other quiz games
- This is purely a game/quiz system; there is no mock gambling! No parlays, no bets, no stakes, no payouts, no prediction markets!!

# Quiz Dashboard

This page is a frontend quiz mode built on top of the existing FUJO backend APIs. It is inspired visually by the now discontinued Project FUJO. 

## Purpose

- Reuse existing endpoints without backend schema changes
- Show only upcoming/open matches
- Let users lock a winner pick (Blue or Red) using a fixed quiz style system

## Session/Auth Behavior
The Page expects the same session values set by the login flow
- `sessionStorage.fujo_user_id`
- `sessionStorage.fujo_balance`
If `fujo_user_id` is missing, it redirects to `login.html`.

## Data Flow
On page load (`Init()`), the dashboard requests:
1. `GET /api/matches`
2. `GET /api/users/:user_id/bets`

Then it:
- builds the shell
- autoselects the next open match (`!has_score`)
- renders the quiz cards
- builds the scrolling bottom ticker

## Quiz Submission Flow

When a user selects Blue/Red and clicks submit:

- `POST /api/bets` is called with:

```json
{
  "user_id": "<session user>",
  "match_id": "<selected open match>",
  "side": "blue | red",
  "stake": 0
}
```

## UI Structure

The page mirrors the now discontinued Project FUJO dashboard layout
- Top bar with scout + points + logout.
- Left sidebar with open matches.
- Main quiz panel with Blue/Red alliance cards.
- Bottom scrolling ticker.



