import { hashPassword, sha256Hex } from "./_auth.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();

    const email = (form.get("email") || "").toString().trim().toLowerCase();
    const token = (form.get("token") || "").toString().trim();
    const newPassword = (form.get("newPassword") || "").toString();
    const confirmPassword = (form.get("confirmPassword") || "").toString();

    if (!email || !token || !newPassword || !confirmPassword) {
      return json({ ok: false, error: "All fields are required." }, 400);
    }

    if (newPassword !== confirmPassword) {
      return json({ ok: false, error: "Passwords do not match." }, 400);
    }

    if (newPassword.length < 8) {
      return json({ ok: false, error: "Password must be at least 8 characters." }, 400);
    }

    const account = await env.DB.prepare(
      `SELECT * FROM client_accounts WHERE email = ? LIMIT 1`
    ).bind(email).first();

    if (!account || !account.reset_token || !account.reset_token_expires_at) {
      return json({ ok: false, error: "Invalid or expired reset request." }, 400);
    }

    if (new Date(account.reset_token_expires_at).getTime() < Date.now()) {
      return json({ ok: false, error: "Reset link has expired." }, 400);
    }

    const incomingHashedToken = await sha256Hex(token);

    if (incomingHashedToken !== account.reset_token) {
      return json({ ok: false, error: "Invalid reset token." }, 400);
    }

    const newHash = await hashPassword(newPassword);
    const now = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE client_accounts
        SET password_hash = ?,
            must_change_password = 0,
            reset_token = NULL,
            reset_token_expires_at = NULL,
            updated_at = ?
       WHERE id = ?`
          ).bind(newHash, now, account.id).run();

    return json({ ok: true, message: "Password reset successfully." });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to reset password." },
      500
    );
  }
}
