const SHEET_ID = "(PLACEHOLDER)";

const SHEET_GIDS = {
  TBA: 0,                
  CoinRef: (PLACEHOLDER),
  BetDB: (PLACEHOLDER),
  WinPredictions: (PLACEHOLDER)
}

const SHEETS_BASE =
  "https://docs.google.com/spreadsheets/d/" +
  SHEET_ID +
  "/gviz/tq?tqx=out:csv&gid=";

const APPS_SCRIPT_URL =
  "(PLACEHOLDER)";

const API_KEY = ""; 

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true }); 
      }

      if (url.pathname === "/api/users" && request.method === "GET") {
        const users = await loadUsers();
        return json({ users: Object.values(users) });
      }

      if (url.pathname === "/api/matches" && request.method === "GET") {
        const matches = await loadMatches();
        return json({ matches });
      }

      if (url.pathname === "/api/bets" && request.method === "POST") {
        const { user_id, match_id, side, stake } = await request.json();

        if (!user_id || !match_id || !["blue", "red"].includes(side) || !(stake > 0)) {
          return badRequest("invalid bet payload");
        }

        const users = await loadUsers();
        const user = users[user_id];
        if (!user) return badRequest("unknown user");
        if (user.balance < stake) return badRequest("insufficient balance"); //TODO: figure out how to give users the points for scouting; maybe just create a new "payments table" that refreshes every say 5 minutes and compares (last) to (current)?

        const matches = await loadMatches();
        const match = matches.find(m => m.match_id === match_id);
        if (!match) return badRequest("match not found");
        if (match.has_score) return badRequest("market closed");

        const bets = await loadBets(match_id);
        const totalBlue = sum(bets.filter(b => b.side === "blue"));
        const totalRed  = sum(bets.filter(b => b.side === "red"));
        const totalPool = totalBlue + totalRed;
        const sideTotal = side === "blue" ? totalBlue : totalRed;

        const odds = (totalPool + stake) / (sideTotal + stake);

        const newBalance = user.balance - stake;

        await updateBalance(user_id, newBalance);
        await appendBet({
          user_id,
          match_id,
          side,
          stake,
          odds,
          created_at: new Date().toISOString()
        });

        return json({
          ok: true,
          bet: { user_id, match_id, side, stake, odds },
          balance: newBalance
        });
      }

      if (
        url.pathname.startsWith("/api/users/") &&
        url.pathname.endsWith("/bets") &&
        request.method === "GET"
      ) {
        const userId = decodeURIComponent(url.pathname.split("/")[3]);
        const bets = await loadAllBets();
        return json({ bets: bets.filter(b => b.user_id === userId) });
      }

      if (url.pathname === "/api/leaderboard" && request.method === "GET") {
        // Load users (balances) and win_predictions (accuracy) in parallel
        const [users, predictions] = await Promise.all([
          loadUsers(),
          loadWinPredictions()
        ]);

        // Aggregate predictions per user
        const stats = {};
        for (const p of predictions) {
          const uid = p.user;
          if (!uid) continue;
          if (!stats[uid]) stats[uid] = { total: 0, correct: 0 };
          stats[uid].total++;
          if (p.points_received === 100) stats[uid].correct++;
        }

        // Merge with balances
        const leaderboard = Object.values(users).map(u => {
          const s = stats[u.user_id] || { total: 0, correct: 0 };
          return {
            user_id: u.user_id,
            balance: u.balance,
            total_picks: s.total,
            correct_picks: s.correct,
            accuracy: s.total > 0 ? s.correct / s.total : 0
          };
        });

        // Sort by balance descending
        leaderboard.sort((a, b) => b.balance - a.balance);

        return json({ leaderboard });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders() });

    } catch (err) {
      return json({ error: String(err.message || err) }, 500);
    }
  }
};

async function loadUsers() {
  const csv = await fetchCsv("CoinRef"); //this pulls from the `TBA` sheet regardless rather unfortunate
  const users = {};
  for (const row of csv) { //no slicing </3
    const [id, , balance] = row;
    if (!id) continue;
    users[id.trim()] = {
      user_id: id.trim(),
      balance: Number(balance || 0)
    };
  }
  return users;
}

async function loadMatches() {
  const csv = await fetchCsv("TBA"); //NO HEADERS
  return csv.map(row => ({
    match_id: row[0],                // quals 1 quals 2 some other bs idek girl
    blue_team: row[1],
    red_team: row[2],
    blue_score: num(row[3]),
    red_score: num(row[4]),
    winner: row[5],
    market_status: row[6],
    has_score: Number.isFinite(+row[3]) && Number.isFinite(+row[4])
  }));
}

async function loadBets(matchId) {
  const csv = await fetchCsv("BetDB");
  return csv
    .slice(1)
    .map(([user_id, match_id, side, stake, odds, created_at]) => ({
      user_id,
      match_id,
      side,
      stake: Number(stake),
      odds: Number(odds),
      created_at
    }))
    .filter(b => b.match_id === matchId);5
}

async function loadAllBets() {
  const csv = await fetchCsv("BetDB");
  return csv.slice(1).map(
    ([user_id, match_id, side, stake, odds, created_at]) => ({
      user_id,
      match_id,
      side,
      stake: Number(stake),
      odds: Number(odds),
      created_at
    })
  );
}

async function loadWinPredictions() {
  // win_predictions sheet columns: User, match_id, predicted_team, match_winner, points_received
  if (SHEET_GIDS.WinPredictions == null) return []; // GID not set yet
  const csv = await fetchCsv("WinPredictions");
  return csv
    .slice(1) // skip header row
    .map(([user, match_id, predicted_team, match_winner, points_received]) => ({
      user: user?.trim(),
      match_id: match_id?.trim(),
      predicted_team: predicted_team?.trim(),
      match_winner: match_winner?.trim(),
      points_received: Number(points_received || 0)
    }))
    .filter(p => p.user);
}

async function gasPost(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0"
    },
    redirect: "follow"
  });

  const text = await res.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("invalid google app scripts response: " + text);
  }

  if (json.error) {
    throw new Error(json.error);
  }

  return json;
}

async function appendBet(bet) {
  return gasPost({
    api_key: API_KEY,
    type: "append_bet",
    bet
  });
}

async function updateBalance(user_id, balance) {
  return gasPost({
    api_key: API_KEY,
    type: "update_balance",
    user_id,
    balance
  });
}

async function fetchCsv(sheetName) {
  const gid = SHEET_GIDS[sheetName];
  if (gid == null) {
    throw new Error("unknown sheet: " + sheetName);
  }

  const res = await fetch(SHEETS_BASE + gid);
  if (!res.ok) {
    throw new Error(`csv fetch failed for ${sheetName} (${res.status})`);
  }

  const text = await res.text();
  return text.trim().split("\n").map(parseCsvLine);
}

function parseCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') q = !q;
    else if (c === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map(s => s.replace(/^"|"$/g, ""));
}

const sum = arr => arr.reduce((a, b) => a + b.stake, 0);
const num = v => (Number.isFinite(+v) ? +v : null);


function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders()
    }
  });
}

function badRequest(msg) {
  return json({ error: msg }, 400);
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*", //wildcard 
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}