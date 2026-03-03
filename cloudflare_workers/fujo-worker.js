const TABLES = {
  users: "users",
  matches: "matches",
  bets: "bets",
  winPredictions: "win_predictions"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/api/health") {
        return json({ ok: true, provider: "supabase" });
      }

      if (url.pathname === "/api/users" && request.method === "GET") {
        const users = await loadUsers(env);
        return json({ users });
      }

      if (url.pathname === "/api/matches" && request.method === "GET") {
        const matches = await loadMatches(env);
        return json({ matches });
      }

      if (url.pathname === "/api/bets" && request.method === "POST") {
        const { user_id, match_id, side, stake } = await request.json();

        if (!user_id || !match_id || !["blue", "red"].includes(side) || !(stake > 0)) {
          return badRequest("invalid bet payload");
        }

        const result = await placeBet(env, { user_id, match_id, side, stake: Number(stake) });

        return json({
          ok: true,
          bet: {
            user_id,
            match_id,
            side,
            stake: Number(stake),
            odds: result.odds
          },
          balance: result.balance
        });
      }

      if (
        url.pathname.startsWith("/api/users/") &&
        url.pathname.endsWith("/bets") &&
        request.method === "GET"
      ) {
        const userId = decodeURIComponent(url.pathname.split("/")[3]);
        const bets = await loadUserBets(env, userId);
        return json({ bets });
      }

      if (url.pathname === "/api/leaderboard" && request.method === "GET") {
        const leaderboard = await loadLeaderboard(env);
        return json({ leaderboard });
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders() });
    } catch (err) {
      return json({ error: String(err.message || err) }, 500);
    }
  }
};

async function loadUsers(env) {
  const rows = await supabaseSelect(env, TABLES.users, "user_id,balance", "order=user_id.asc");
  return rows.map(row => ({
    user_id: row.user_id,
    balance: Number(row.balance || 0)
  }));
}

async function loadMatches(env) {
  const rows = await supabaseSelect(env,
    TABLES.matches,
    "match_id,blue_team,red_team,blue_score,red_score,winner,market_status",
    "order=match_id.asc"
  );

  return rows.map(row => ({
    match_id: row.match_id,
    blue_team: row.blue_team,
    red_team: row.red_team,
    blue_score: num(row.blue_score),
    red_score: num(row.red_score),
    winner: row.winner,
    market_status: row.market_status,
    has_score: Number.isFinite(+row.blue_score) && Number.isFinite(+row.red_score)
  }));
}

async function loadUserBets(env, userId) {
  const query = `user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`;
  const rows = await supabaseSelect(env,
    TABLES.bets,
    "user_id,match_id,side,stake,odds,created_at",
    query
  );

  return rows.map(row => ({
    user_id: row.user_id,
    match_id: row.match_id,
    side: row.side,
    stake: Number(row.stake || 0),
    odds: Number(row.odds || 0),
    created_at: row.created_at
  }));
}

async function loadLeaderboard(env) {
  const [users, predictions] = await Promise.all([
    supabaseSelect(env, TABLES.users, "user_id,balance"),
    supabaseSelect(env, TABLES.winPredictions, "user,points_received")
  ]);

  const stats = {};
  for (const prediction of predictions) {
    const uid = prediction.user;
    if (!uid) continue;

    if (!stats[uid]) {
      stats[uid] = { total: 0, correct: 0 };
    }

    stats[uid].total += 1;
    if (Number(prediction.points_received || 0) === 100) {
      stats[uid].correct += 1;
    }
  }

  const leaderboard = users.map(user => {
    const userStats = stats[user.user_id] || { total: 0, correct: 0 };
    return {
      user_id: user.user_id,
      balance: Number(user.balance || 0),
      total_picks: userStats.total,
      correct_picks: userStats.correct,
      accuracy: userStats.total > 0 ? userStats.correct / userStats.total : 0
    };
  });

  leaderboard.sort((a, b) => b.balance - a.balance);
  return leaderboard;
}

async function placeBet(env, payload) {
  const result = await supabaseRpc(env, "place_bet", payload);

  if (!result || typeof result !== "object") {
    throw new Error("invalid place_bet response from supabase rpc");
  }

  if (result.error) {
    throw new Error(result.error);
  }

  return {
    odds: Number(result.odds || 0),
    balance: Number(result.balance || 0)
  };
}

async function supabaseSelect(env, table, selectColumns, query = "") {
  const suffix = query ? `&${query}` : "";
  const res = await fetch(
    `${supabaseUrl(env)}/rest/v1/${table}?select=${selectColumns}${suffix}`,
    {
      method: "GET",
      headers: supabaseHeaders(env)
    }
  );

  const data = await parseSupabaseResponse(res);
  return Array.isArray(data) ? data : [];
}

async function supabaseRpc(env, functionName, payload) {
  const res = await fetch(`${supabaseUrl(env)}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(env),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseSupabaseResponse(res);
}

async function parseSupabaseResponse(res) {
  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const message = data?.message || data?.error || text || "supabase request failed";
    throw new Error(`supabase error (${res.status}): ${message}`);
  }

  return data;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function supabaseHeaders(env) {
  return {
    apikey: supabaseServiceRoleKey(env),
    Authorization: `Bearer ${supabaseServiceRoleKey(env)}`
  };
}


function supabaseUrl(env) {
  return env?.SUPABASE_URL || "(PLACEHOLDER_SUPABASE_URL)";
}

function supabaseServiceRoleKey(env) {
  return env?.SUPABASE_SERVICE_ROLE_KEY || "(PLACEHOLDER_SUPABASE_SERVICE_ROLE_KEY)";
}

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
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization"
  };
}
