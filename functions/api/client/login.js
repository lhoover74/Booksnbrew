async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
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

    if (!account) {
      return json({ ok: false, error: "Invalid login." }, 401);
    }

    const incomingHash = await sha256(password);

    if (incomingHash !== account.password_hash) {
      return json({ ok: false, error: "Invalid login." }, 401);
    }

    const sessionToken = await sha256(
      `${account.email}|${account.lead_id}|${env.CLIENT_SESSION_SECRET || ""}`
    );

    return json(
      { ok: true },
      200,
      {
        "Set-Cookie": [
          `bb_client_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax`,
          `bb_client_lead_id=${account.lead_id}; Path=/; HttpOnly; Secure; SameSite=Lax`
        ].join(", ")
      }
    );
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Login failed." },
      500
    );
  }
}