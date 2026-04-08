function parseCookies(cookieHeader) {
  const cookies = {};
  (cookieHeader || "").split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index === -1) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = value;
  });
  return cookies;
}

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
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const cookies = parseCookies(request.headers.get("Cookie"));
    const leadId = cookies.bb_client_lead_id;

    if (!leadId) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const form = await request.formData();
    const currentPassword = (form.get("currentPassword") || "").toString();
    const newPassword = (form.get("newPassword") || "").toString();
    const confirmPassword = (form.get("confirmPassword") || "").toString();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return json({ ok: false, error: "All fields are required." }, 400);
    }

    if (newPassword !== confirmPassword) {
      return json({ ok: false, error: "New passwords do not match." }, 400);
    }

    if (newPassword.length < 8) {
      return json({ ok: false, error: "New password must be at least 8 characters." }, 400);
    }

    const account = await env.DB.prepare(
      `SELECT * FROM client_accounts WHERE lead_id = ? LIMIT 1`
    ).bind(leadId).first();

    if (!account) {
      return json({ ok: false, error: "Client account not found." }, 404);
    }

    const currentHash = await sha256(currentPassword);

    if (currentHash !== account.password_hash) {
      return json({ ok: false, error: "Current password is incorrect." }, 401);
    }

    const newHash = await sha256(newPassword);

    await env.DB.prepare(
      `UPDATE client_accounts
       SET password_hash = ?, must_change_password = 0, reset_token = NULL, reset_token_expires_at = NULL
       WHERE id = ?`
    ).bind(newHash, account.id).run();

    return json({ ok: true, message: "Password updated successfully." });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update password." },
      500
    );
  }
}
