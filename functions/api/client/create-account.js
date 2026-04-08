async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

    const leadId = (form.get("leadId") || "").toString().trim();
    const email = (form.get("email") || "").toString().trim().toLowerCase();
    const password = (form.get("password") || "").toString();

    if (!leadId || !email || !password) {
      return json(
        { ok: false, error: "Lead ID, email, and password are required." },
        400
      );
    }

    const existing = await env.DB.prepare(
      `SELECT id FROM client_accounts WHERE email = ? LIMIT 1`
    )
      .bind(email)
      .first();

    if (existing) {
      return json(
        { ok: false, error: "A client account already exists for this email." },
        409
      );
    }

    const passwordHash = await sha256(password);
    const createdAt = new Date().toISOString();

    const result = await env.DB.prepare(
      `INSERT INTO client_accounts (lead_id, email, password_hash, created_at)
       VALUES (?, ?, ?, ?)`
    )
      .bind(leadId, email, passwordHash, createdAt)
      .run();

    return json({
      ok: true,
      clientAccountId: result.meta?.last_row_id || null
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to create account."
      },
      500
    );
  }
}