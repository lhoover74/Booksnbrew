async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) {
    throw new Error("Missing Stripe signature header or webhook secret.");
  }

  const parts = signatureHeader.split(",").reduce((acc, item) => {
    const [key, value] = item.split("=");
    if (key && value) acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    throw new Error("Invalid Stripe-Signature header.");
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload)
  );

  const expected = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expected !== signature) {
    throw new Error("Webhook signature verification failed.");
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (Number.isNaN(ageSeconds) || ageSeconds > 300) {
    throw new Error("Webhook timestamp is too old.");
  }

  return true;
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

    const signatureHeader = request.headers.get("Stripe-Signature");
    const rawBody = await request.text();

    await verifyStripeSignature(
      rawBody,
      signatureHeader,
      env.STRIPE_WEBHOOK_SECRET
    );

    const event = JSON.parse(rawBody);
    const type = event.type;
    const object = event.data?.object;

    if (!object) {
      return json({ ok: true });
    }

    if (
      type === "checkout.session.completed" ||
      type === "checkout.session.async_payment_succeeded"
    ) {
      const sessionId = object.id || null;
      const paymentIntentId = object.payment_intent || null;
      const customerEmail = object.customer_details?.email || object.customer_email || null;

      if (sessionId) {
        const now = new Date().toISOString();

        await env.DB.prepare(
          `UPDATE invoices
           SET status = 'Paid',
               stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id),
               stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
               stripe_customer_email = COALESCE(?, stripe_customer_email),
               paid_at = ?,
               updated_at = ?
           WHERE stripe_checkout_session_id = ?`
        ).bind(
          sessionId,
          paymentIntentId,
          customerEmail,
          now,
          now,
          sessionId
        ).run();
      }
    }

    if (
  type === "checkout.session.completed" ||
  type === "checkout.session.async_payment_succeeded"
) {
  const sessionId = object.id || null;
  const paymentIntentId = object.payment_intent || null;
  const customerEmail = object.customer_details?.email || object.customer_email || null;
  const invoiceId = object.metadata?.invoice_id || null;
  const now = new Date().toISOString();

  if (invoiceId) {
    await env.DB.prepare(
      `UPDATE invoices
       SET status = 'Paid',
           stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id),
           stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
           stripe_customer_email = COALESCE(?, stripe_customer_email),
           paid_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).bind(
      sessionId,
      paymentIntentId,
      customerEmail,
      now,
      now,
      invoiceId
    ).run();
  } else if (sessionId) {
    await env.DB.prepare(
      `UPDATE invoices
       SET status = 'Paid',
           stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id),
           stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
           stripe_customer_email = COALESCE(?, stripe_customer_email),
           paid_at = ?,
           updated_at = ?
       WHERE stripe_checkout_session_id = ?`
    ).bind(
      sessionId,
      paymentIntentId,
      customerEmail,
      now,
      now,
      sessionId
    ).run();
  }
}