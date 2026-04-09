function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function generateTemporaryPassword(length = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function hashPassword(password) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 120000;

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations
    },
    keyMaterial,
    256
  );

  const hashBytes = new Uint8Array(bits);

  function toBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  return `pbkdf2$${iterations}$${toBase64(salt)}$${toBase64(hashBytes)}`;
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();

    const leadId = (form.get("leadId") || "").toString().trim();
    const email = (form.get("email") || "").toString().trim().toLowerCase();
    const incomingPassword = (form.get("password") || "").toString().trim();
    const nameInput = (form.get("name") || "").toString().trim();
    const setNewPassword = (form.get("setNewPassword") || "").toString().trim().toLowerCase() === "true";

    if (!email && !leadId) {
      return json(
        { ok: false, error: "Lead ID or email is required." },
        400
      );
    }

    let account = null;
    if (leadId) {
      account = await env.DB.prepare(
        `SELECT * FROM client_accounts WHERE lead_id = ? LIMIT 1`
      ).bind(leadId).first();
    }

    if (!account && email) {
      account = await env.DB.prepare(
        `SELECT * FROM client_accounts WHERE email = ? LIMIT 1`
      ).bind(email).first();
    }

    if (!account) {
      return json({ ok: false, error: "Client account not found." }, 404);
    }

    const lead = await env.DB.prepare(
      `SELECT * FROM leads WHERE id = ? LIMIT 1`
    ).bind(account.lead_id).first();

    const finalName = nameInput || lead?.name || "Client";
    const finalEmail = account.email;

    let temporaryPassword = "";
    if (setNewPassword || incomingPassword) {
      temporaryPassword = incomingPassword || generateTemporaryPassword();
      if (temporaryPassword.length < 8) {
        return json({ ok: false, error: "Password must be at least 8 characters." }, 400);
      }

      const passwordHash = await hashPassword(temporaryPassword);
      await env.DB.prepare(
        `UPDATE client_accounts
         SET password_hash = ?,
             must_change_password = 1,
             updated_at = ?
         WHERE id = ?`
      ).bind(passwordHash, new Date().toISOString(), account.id).run();
    }

    const loginUrl = "https://booksnbrew.pages.dev/client/login.html";
    const forgotUrl = "https://booksnbrew.pages.dev/client/forgot-password.html";

    const passwordBlock = temporaryPassword
      ? `
          <p style="margin:0;font-size:15px;line-height:1.8;color:#4f443d;">
            <strong>Temporary Password:</strong> ${escapeHtml(temporaryPassword)}
          </p>
        `
      : `
          <p style="margin:0;font-size:15px;line-height:1.8;color:#4f443d;">
            <strong>Password:</strong> Use your existing password, or reset it below.
          </p>
          <p style="margin:8px 0 0;font-size:14px;line-height:1.7;color:#6f6258;">
            Forgot password: <a href="${forgotUrl}" style="color:#9f6e43;">${forgotUrl}</a>
          </p>
        `;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Your Client Portal Access</title>
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
                  Your client portal is ready
                </h1>
                <p style="margin:14px 0 0;font-size:15px;line-height:1.8;color:#6f6258;">
                  You can now log in securely to view your project details, status, and updates.
                </p>
              </div>

              <div style="padding:30px;">
                <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#524840;">
                  Hi ${escapeHtml(finalName)},
                </p>

                <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#65584f;">
                  Your Books and Brews client portal access has been created.
                </p>

                <div style="margin:22px 0;padding:18px;background:#efe9e3;border:1px solid #d7c8bb;border-radius:18px;">
                  <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#b07b4d;margin-bottom:10px;">
                    Login Details
                  </div>
                  <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;">
                    <strong>Email:</strong> ${escapeHtml(finalEmail)}
                  </p>
                  ${passwordBlock}
                </div>

                <div style="margin-top:24px;text-align:center;">
                  <a href="${loginUrl}"
                    style="display:inline-block;padding:14px 26px;background:#c79058;color:#1a120e;text-decoration:none;border-radius:8px;font-weight:600;">
                    Open Client Portal
                  </a>
                </div>

                <p style="margin:22px 0 0;font-size:14px;line-height:1.8;color:#7a6c62;">
                  For security, keep your login details private. You can use this portal to view project information and updates.
                </p>

                <div style="margin-top:30px;">
                  <p style="margin:0;font-size:15px;color:#3d322d;">
                    Books and Brews
                  </p>
                  <p style="margin:4px 0 0;font-size:13px;color:#7a6c62;">
                    Smart Websites. Smooth Experience.
                  </p>
                  <p style="margin:10px 0 0;font-size:13px;color:#9a8b7f;">
                    https://booksnbrew.pages.dev
                  </p>
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
        to: [finalEmail],
        subject: "Your Books and Brews Client Portal Access",
        html,
        replyTo: "michael@govdirect.org"
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      return json(
        { ok: false, error: resendData },
        500
      );
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE client_accounts
       SET invite_sent_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(now, now, account.id).run();

    return json({ ok: true, inviteSentTo: finalEmail, temporaryPassword: temporaryPassword || null });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to send invite."
      },
      500
    );
  }
}
