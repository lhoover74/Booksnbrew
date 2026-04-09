import {
  getAuthenticatedClient,
  hashPassword,
  verifyPassword
} from "./_auth.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const account = await getAuthenticatedClient(request, env);
    if (!account) {
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

    const validCurrent = await verifyPassword(currentPassword, account.password_hash);
    if (!validCurrent) {
      return json({ ok: false, error: "Current password is incorrect." }, 401);
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

    return json({ ok: true, message: "Password updated successfully." });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update password." },
      500
    );
  }
}
