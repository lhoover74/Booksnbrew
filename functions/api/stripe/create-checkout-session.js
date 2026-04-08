function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function formEncode(obj) {
  return Object.entries(obj)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value ?? "")}`)
    .join("&");
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

    const lead = await env.DB.prepare(
      `SELECT * FROM leads WHERE id = ? LIMIT 1`
    ).bind(invoice.lead_id).first();

    if (!lead) {
      return json({ ok: false, error: "Lead not found for invoice." }, 404);
    }

    const amountCents = Math.round(Number(invoice.amount || 0) * 100);
    if (!amountCents || amountCents < 50) {
      return json({ ok: false, error: "Invoice amount must be at least $0.50." }, 400);
    }

    const payload = {
      mode: "payment",
      success_url: env.STRIPE_SUCCESS_URL,
      cancel_url: env.STRIPE_CANCEL_URL,
      client_reference_id: String(invoice.id),
      customer_email: lead.email || "",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][product_data][name]": invoice.notes || `Invoice ${invoice.invoice_number}`,
      "line_items[0][price_data][unit_amount]": String(amountCents),
      "line_items[0][quantity]": "1",
      "metadata[invoice_id]": String(invoice.id),
      "metadata[lead_id]": String(invoice.lead_id),
      "metadata[invoice_number]": invoice.invoice_number || ""
    };

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formEncode(payload)
    });

    const stripeData = await stripeResponse.json();

    if (!stripeResponse.ok) {
      return json({ ok: false, error: stripeData }, 500);
    }

    const now = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE invoices
       SET payment_url = ?,
           stripe_checkout_session_id = ?,
           stripe_customer_email = ?,
           status = CASE WHEN status = 'Draft' THEN 'Sent' ELSE status END,
           updated_at = ?
       WHERE id = ?`
    ).bind(
      stripeData.url || null,
      stripeData.id || null,
      lead.email || null,
      now,
      invoice.id
    ).run();

    return json({
      ok: true,
      url: stripeData.url,
      sessionId: stripeData.id
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create checkout session." },
      500
    );
  }
}