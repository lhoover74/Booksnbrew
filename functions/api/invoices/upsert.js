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

    const leadId = (form.get("leadId") || "").toString().trim();
    const invoiceId = (form.get("invoiceId") || "").toString().trim();
    const invoiceNumber = (form.get("invoiceNumber") || "").toString().trim();
    const amount = Number((form.get("amount") || "0").toString());
    const status = (form.get("status") || "Draft").toString().trim();
    const dueDate = (form.get("dueDate") || "").toString().trim();
    const paymentUrl = (form.get("paymentUrl") || "").toString().trim();
    const notes = (form.get("notes") || "").toString().trim();

    if (!leadId || !invoiceNumber || Number.isNaN(amount) || amount <= 0) {
      return json({ ok: false, error: "Lead ID, invoice number, and amount are required." }, 400);
    }

    const now = new Date().toISOString();

    if (invoiceId) {
      await env.DB.prepare(
        `UPDATE invoices
         SET invoice_number = ?, amount = ?, status = ?, due_date = ?, payment_url = ?, notes = ?, updated_at = ?
         WHERE id = ? AND lead_id = ?`
      ).bind(
        invoiceNumber,
        amount,
        status,
        dueDate || null,
        paymentUrl || null,
        notes || null,
        now,
        invoiceId,
        leadId
      ).run();

      return json({ ok: true, updated: true });
    }

    const result = await env.DB.prepare(
      `INSERT INTO invoices
       (lead_id, invoice_number, amount, status, due_date, payment_url, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      leadId,
      invoiceNumber,
      amount,
      status,
      dueDate || null,
      paymentUrl || null,
      notes || null,
      now,
      now
    ).run();

    return json({ ok: true, created: true, invoiceId: result.meta?.last_row_id || null });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to save invoice." },
      500
    );
  }
}
