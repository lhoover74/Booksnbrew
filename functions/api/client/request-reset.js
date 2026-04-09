import { sha256Hex } from "./_auth.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();
    const email = (form.get("email") || "").toString().trim().toLowerCase();

    if (!email) {
      return json({ ok: false, error: "Email is required." }, 400);
    }

    const account = await env.DB.prepare(
      `SELECT * FROM client_accounts WHERE email = ? LIMIT 1`
    ).bind(email).first();

    // Return success even if not found, so you do not leak which emails exist
    if (!account) {
      return json({ ok: true, message: "If that email exists, a reset link has been sent." });
    }

    const rawToken = crypto.randomUUID();
    const hashedToken = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString();

    await env.DB.prepare(
      `UPDATE client_accounts
       SET reset_token = ?, reset_token_expires_at = ?
       WHERE id = ?`
    ).bind(hashedToken, expiresAt, account.id).run();

    const resetUrl = `https://booksnbrew.pages.dev/client/reset-password.html?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Reset Your Password</title>
      </head>
      <body style="margin:0;padding:0;background:#0b0b0c;font-family:Inter,Arial,sans-serif;color:#f5ede3;">
        <div style="margin:0;padding:32px 16px;background:#0b0b0c;">
          <div style="max-width:700px;margin:0 auto;">
            <div style="background:#f4f0eb;border:1px solid #ddd3ca;border-radius:24px;overflow:hidden;">
              <div style="padding:30px 30px 24px;background:
                radial-gradient(circle at top right, rgba(199,144,88,.12), transparent 28%),
                linear-gradient(180deg,#f7f4ef,#f1ece6);
                border-bottom:1px solid #ddd3ca;">
                <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#7b6a5f;margin-bottom:12px;">
                  Books and Brews
                </div>
                <h1 style="margin:0;font-size:34px;line-height:1.06;color:#3b302b;font-family:Georgia,serif;font-weight:700;">
                  Reset your portal password
                </h1>
                <p style="margin:14px 0 0;font-size:15px;line-height:1.8;color:#6f6258;">
                  Use the button below to set a new password for your client portal.
                </p>
              </div>

              <div style="padding:30px;">
                <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#65584f;">
                  If you requested a password reset, click below. This link expires in 1 hour.
                </p>

                <div style="margin-top:24px;text-align:center;">
                  <a href="${resetUrl}"
                    style="display:inline-block;padding:14px 26px;background:#c79058;color:#1a120e;text-decoration:none;border-radius:8px;font-weight:600;">
                    Reset Password
                  </a>
                </div>

                <p style="margin:22px 0 0;font-size:14px;line-height:1.8;color:#7a6c62;word-break:break-word;">
                  If the button does not work, use this link:<br>${escapeHtml(resetUrl)}
                </p>

                <div style="margin-top:30px;">
                  <p style="margin:0;font-size:15px;color:#3d322d;">Books and Brews</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#7a6c62;">Smart Websites. Smooth Experience.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Books and Brews <quotes@booksnbrew.govdirect.org>",
        to: [email],
        subject: "Reset your Books and Brews client portal password",
        html,
        replyTo: "michael@govdirect.org"
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      return json({ ok: false, error: resendData }, 500);
    }

    return json({ ok: true, message: "If that email exists, a reset link has been sent." });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Reset request failed." },
      500
    );
  }
}
