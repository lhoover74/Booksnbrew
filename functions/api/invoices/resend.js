function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
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

async function sendInvoiceEmail(env, lead, invoice, paymentUrl) {
  const invoiceHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Your Invoice</title>
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
                Your invoice is ready
              </h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.8;color:#6f6258;">
                You can review and pay your invoice securely online.
              </p>
            </div>

            <div style="padding:30px;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#524840;">
                Hi ${escapeHtml(lead.name || "Client")},
              </p>

              <div style="margin:22px 0;padding:18px;background:#efe9e3;border:1px solid #d7c8bb;border-radius:18px;">
                <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#b07b4d;margin-bottom:10px;">
                  Invoice Details
                </div>
                <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>Invoice:</strong> ${escapeHtml(invoice.invoice_number || "")}
                </p>
                <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>Amount:</strong> $${Number(invoice.amount || 0).toFixed(2)}
                </p>
                <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>Status:</strong> ${escapeHtml(invoice.status || "Sent")}
                </p>
                <p style="margin:0;font-size:15px;line-height:1.8;color:#4f443d;">
                  <strong>Due Date:</strong> ${escapeHtml(invoice.due_date || "Not specified")}
                </p>
              </div>

              <div style="margin-top:24px;text-align:center;">
                <a href="${paymentUrl}"
                  style="display:inline-block;padding:14px 26px;background:#c79058;color:#1a120e;text-decoration:none;border-radius:8px;font-weight:600;">
                  Pay Invoice
                </a>
              </div>

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

  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Books and Brews <quotes@booksnbrew.govdirect.org>",
      to: [lead.email],
      subject: `Invoice ${invoice.invoice_number} from Books and Brews`,
      html: invoiceHtml,
      replyTo: "michael@govdirect.org"
    })
  });

  const emailData = await emailResponse.json();

  if (!emailResponse.ok) {
    throw new Error(
      typeof emailData?.message === "string"
        ? emailData.message
        : "Invoice email failed to send."
    );
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();
    const invoiceId = (form.get("invoiceId") || "").toString().trim();

    if (!invoiceId) {
      return json({ ok: false, error: "invoiceId is required." }, 400);
    }

    const invoice = await env.DB.prepare(
      `SELECT * FROM invoices WHERE id = ? LIMIT 1`
    ).bind(invoiceId).first();

    if (!invoice) {
      return json({ ok: false, error: "Invoice not found." }, 404);
    }

    if (!invoice.payment_url) {
      return json({ ok: false, error: "Invoice does not have a payment link yet." }, 400);
    }

    const lead = await env.DB.prepare(
      `SELECT * FROM leads WHERE id = ? LIMIT 1`
    ).bind(invoice.lead_id).first();

    if (!lead) {
      return json({ ok: false, error: "Lead not found for invoice." }, 404);
    }

    await sendInvoiceEmail(env, lead, invoice, invoice.payment_url);

    const now = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE invoices
       SET emailed_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(now, now, invoice.id).run();

    return json({ ok: true, resent: true });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to resend invoice." },
      500
    );
  }
}
