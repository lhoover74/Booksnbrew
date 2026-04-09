import { getAuthenticatedClient } from "./_auth.js";

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

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const account = await getAuthenticatedClient(request, env);
    if (!account) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const leadId = account.lead_id;

    const form = await request.formData();
    const subject = (form.get("subject") || "").toString().trim();
    const message = (form.get("message") || "").toString().trim();

    if (!subject || !message) {
      return json({ ok: false, error: "Subject and message are required." }, 400);
    }

    const lead = await env.DB.prepare(
      `SELECT * FROM leads WHERE id = ? LIMIT 1`
    ).bind(leadId).first();

    if (!lead) {
      return json({ ok: false, error: "Lead not found." }, 404);
    }

    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO project_messages (lead_id, sender_type, sender_name, subject, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(leadId, "client", lead.name || "Client", subject, message, createdAt)
      .run();

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>New Client Reply</title>
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
                  New client reply
                </h1>
              </div>

              <div style="padding:30px;">
                <p style="margin:0 0 12px;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>Client:</strong> ${escapeHtml(lead.name || "Client")}
                </p>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>Email:</strong> ${escapeHtml(lead.email || "")}
                </p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>Subject:</strong> ${escapeHtml(subject)}
                </p>

                <div style="margin:22px 0;padding:18px;background:#efe9e3;border:1px solid #d7c8bb;border-radius:18px;">
                  <div style="font-size:15px;line-height:1.9;color:#4f443d;">
                    ${escapeHtml(message).replace(/\n/g, "<br>")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Books and Brews <quotes@booksnbrew.govdirect.org>",
        to: ["michael@govdirect.org"],
        subject: `Client Reply: ${subject}`,
        html,
        replyTo: lead.email || "michael@govdirect.org"
      })
    });

    return json({ ok: true });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to send reply."
      },
      500
    );
  }
}
