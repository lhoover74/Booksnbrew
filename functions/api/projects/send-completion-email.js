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
    const form = await request.formData();

    const leadId = (form.get("leadId") || "").toString().trim();

    if (!leadId) {
      return json({ ok: false, error: "Lead ID is required." }, 400);
    }

    const lead = await env.DB.prepare(
      `SELECT * FROM leads WHERE id = ? LIMIT 1`
    ).bind(leadId).first();

    if (!lead) {
      return json({ ok: false, error: "Lead not found." }, 404);
    }

    const project = await env.DB.prepare(
      `SELECT * FROM client_projects WHERE lead_id = ? LIMIT 1`
    ).bind(leadId).first();

    if (!project) {
      return json({ ok: false, error: "Project not found." }, 404);
    }

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <body style="margin:0;padding:0;background:#0b0b0c;font-family:Arial,sans-serif;">
        <div style="max-width:700px;margin:0 auto;padding:32px 16px;">
          <div style="background:#f4f0eb;border:1px solid #ddd3ca;border-radius:24px;overflow:hidden;">
            <div style="padding:30px 30px 24px;background:
              radial-gradient(circle at top right, rgba(199,144,88,.12), transparent 28%),
              linear-gradient(180deg,#f7f4ef,#f1ece6);
              border-bottom:1px solid #ddd3ca;">
              <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#7b6a5f;margin-bottom:12px;">
                Books and Brews
              </div>
              <h1 style="margin:0;font-size:34px;line-height:1.08;color:#3b302b;font-family:Georgia,serif;">
                Your project is complete
              </h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.8;color:#6f6258;">
                Your website project has been completed and delivered.
              </p>
            </div>

            <div style="padding:30px;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#524840;">
                Hi ${escapeHtml(lead.name || "Client")},
              </p>

              <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#65584f;">
                Your project with Books and Brews has been marked complete.
              </p>

              <div style="margin:22px 0;padding:18px;background:#efe9e3;border:1px solid #d7c8bb;border-radius:18px;">
                <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>Project:</strong> ${escapeHtml(project.title || "Website Project")}
                </p>
                <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>Status:</strong> Complete
                </p>
                <p style="margin:0;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>Delivered:</strong> ${escapeHtml(project.completed_at || new Date().toISOString())}
                </p>
              </div>

              <div style="margin:22px 0;padding:18px;background:#efe9e3;border:1px solid #d7c8bb;border-radius:18px;">
                <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#b07b4d;margin-bottom:10px;">
                  Final Notes
                </div>
                <div style="font-size:15px;line-height:1.9;color:#4f443d;">
                  ${escapeHtml(project.final_message || "Your project has been completed and delivered.").replace(/\n/g, "<br>")}
                </div>
              </div>

              <div style="margin:22px 0;padding:18px;background:#efe9e3;border:1px solid #d7c8bb;border-radius:18px;">
                <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#b07b4d;margin-bottom:10px;">
                  Ongoing Support
                </div>
                <div style="font-size:15px;line-height:1.9;color:#4f443d;">
                  ${escapeHtml(project.maintenance_offer || "Ongoing maintenance and support are available if needed.").replace(/\n/g, "<br>")}
                </div>
              </div>

              <p style="margin:22px 0 0;font-size:14px;line-height:1.8;color:#7a6c62;">
                You can log in to your client portal to review your project details, files, and updates.
              </p>
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
        to: [lead.email],
        subject: `Your project is complete | Books and Brews`,
        html,
        replyTo: "michael@govdirect.org"
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      return json({ ok: false, error: resendData }, 500);
    }

    return json({ ok: true, emailed: true });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to send completion email." },
      500
    );
  }
}