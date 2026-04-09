import { hashPassword } from "./_auth.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
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

function toBool(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendInviteEmail(env, payload) {
  const { name, email, temporaryPassword } = payload;
  const loginUrl = "https://booksnbrew.pages.dev/client/login.html";
  const forgotUrl = "https://booksnbrew.pages.dev/client/forgot-password.html";

  const passwordBlock = temporaryPassword
    ? `
      <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;">
        <strong>Temporary Password:</strong> ${escapeHtml(temporaryPassword)}
      </p>
    `
    : `
      <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;">
        <strong>Password:</strong> Use your existing password.
      </p>
      <p style="margin:0;font-size:14px;line-height:1.8;color:#6f6258;">
        If you need a new password, use <a href="${forgotUrl}" style="color:#9f6e43;">Forgot Password</a>.
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
            </div>

            <div style="padding:30px;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#524840;">Hi ${escapeHtml(name || "Client")},</p>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#65584f;">
                Your Books and Brews client account is active.
              </p>

              <div style="margin:22px 0;padding:18px;background:#efe9e3;border:1px solid #d7c8bb;border-radius:18px;">
                <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#b07b4d;margin-bottom:10px;">Login Details</div>
                <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;"><strong>Email:</strong> ${escapeHtml(email)}</p>
                ${passwordBlock}
              </div>

              <div style="margin-top:24px;text-align:center;">
                <a href="${loginUrl}" style="display:inline-block;padding:14px 26px;background:#c79058;color:#1a120e;text-decoration:none;border-radius:8px;font-weight:600;">
                  Open Client Portal
                </a>
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
      subject: "Your Books and Brews client portal access",
      html,
      replyTo: "michael@govdirect.org"
    })
  });

  const resendData = await resendResponse.json();
  if (!resendResponse.ok) {
    throw new Error(
      typeof resendData?.message === "string"
        ? resendData.message
        : "Failed to send invite email."
    );
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();

    const leadId = (form.get("leadId") || "").toString().trim();
    const email = (form.get("email") || "").toString().trim().toLowerCase();
    const name = (form.get("name") || "").toString().trim();
    const passwordInput = (form.get("password") || "").toString();
    const sendInvite = toBool(form.get("sendInvite") || "true");

    if (!leadId || !email) {
      return json(
        { ok: false, error: "Lead ID and email are required." },
        400
      );
    }

    const lead = await env.DB.prepare(
      `SELECT * FROM leads WHERE id = ? LIMIT 1`
    ).bind(leadId).first();

    if (!lead) {
      return json({ ok: false, error: "Lead not found." }, 404);
    }

    const existingLeadAccount = await env.DB.prepare(
      `SELECT id FROM client_accounts WHERE lead_id = ? LIMIT 1`
    ).bind(leadId).first();

    if (existingLeadAccount) {
      return json(
        { ok: false, error: "A client account already exists for this lead." },
        409
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

    const temporaryPassword = passwordInput || generateTemporaryPassword();
    if (temporaryPassword.length < 8) {
      return json({ ok: false, error: "Password must be at least 8 characters." }, 400);
    }

    const passwordHash = await hashPassword(temporaryPassword);
    const createdAt = new Date().toISOString();

    const result = await env.DB.prepare(
      `INSERT INTO client_accounts
       (
         lead_id,
         email,
         password_hash,
         is_active,
         must_change_password,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, 1, 1, ?, ?)`
    )
      .bind(leadId, email, passwordHash, createdAt, createdAt)
      .run();

    if (sendInvite) {
      await sendInviteEmail(env, {
        name: name || lead.name || "Client",
        email,
        temporaryPassword
      });

      await env.DB.prepare(
        `UPDATE client_accounts
         SET invite_sent_at = ?, updated_at = ?
         WHERE id = ?`
      ).bind(createdAt, createdAt, result.meta?.last_row_id || null).run();
    }

    return json({
      ok: true,
      clientAccountId: result.meta?.last_row_id || null,
      temporaryPassword,
      inviteSent: sendInvite
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