import {
  buildSessionCookies,
  createClientSession,
  verifyPassword
} from "./_auth.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();

    const email = (form.get("email") || "").toString().trim().toLowerCase();
    const password = (form.get("password") || "").toString();

    if (!email || !password) {
      return json({ ok: false, error: "Email and password are required." }, 400);
    }

    const account = await env.DB.prepare(
      `SELECT * FROM client_accounts WHERE email = ? LIMIT 1`
    )
      .bind(email)
      .first();

    if (!account || Number(account.is_active || 1) !== 1) {
      return json({ ok: false, error: "Invalid login." }, 401);
    }

    const isValidPassword = await verifyPassword(password, account.password_hash);
    if (!isValidPassword) {
      return json({ ok: false, error: "Invalid login." }, 401);
    }

    const session = await createClientSession(env, account);
    const cookies = buildSessionCookies(session.token, account);

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    cookies.forEach((cookie) => headers.append("Set-Cookie", cookie));

    return new Response(JSON.stringify({ ok: true, mustChangePassword: Number(account.must_change_password || 0) === 1 }), {
      status: 200,
      headers
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Login failed." },
      500
    );
  }
}