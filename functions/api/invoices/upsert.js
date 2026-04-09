function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeInvoiceType(value) {
  const normalized = (value || "").toString().trim().toLowerCase();
  if (normalized === "deposit" || normalized === "balance" || normalized === "full") {
    return normalized;
  }
  return "full";
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return roundMoney(parsed);
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
    const invoiceType = normalizeInvoiceType(form.get("invoiceType") || "full");
    const totalProjectAmount = normalizeNullableNumber(form.get("totalProjectAmount"));
    const depositPercentRaw = normalizeNullableNumber(form.get("depositPercent"));
    const parentInvoiceId = (form.get("parentInvoiceId") || "").toString().trim() || null;
    const balanceDueAmount = normalizeNullableNumber(form.get("balanceDueAmount"));

    if (!leadId || !invoiceNumber || Number.isNaN(amount) || amount <= 0) {
      return json({ ok: false, error: "Lead ID, invoice number, and amount are required." }, 400);
    }

    const safeAmount = roundMoney(amount);
    const safeDepositPercent = depositPercentRaw === null
      ? null
      : Math.min(100, Math.max(0, depositPercentRaw));

    const now = new Date().toISOString();

    if (invoiceId) {
      await env.DB.prepare(
        `UPDATE invoices
         SET invoice_number = ?,
             amount = ?,
             status = ?,
             due_date = ?,
             payment_url = ?,
             notes = ?,
             invoice_type = ?,
             total_project_amount = ?,
             deposit_percent = ?,
             parent_invoice_id = ?,
             balance_due_amount = ?,
             updated_at = ?
         WHERE id = ? AND lead_id = ?`
      ).bind(
        invoiceNumber,
        safeAmount,
        status,
        dueDate || null,
        paymentUrl || null,
        notes || null,
        invoiceType,
        totalProjectAmount,
        safeDepositPercent,
        parentInvoiceId,
        balanceDueAmount,
        now,
        invoiceId,
        leadId
      ).run();

      return json({ ok: true, updated: true });
    }

    const result = await env.DB.prepare(
      `INSERT INTO invoices
       (
         lead_id,
         invoice_number,
         amount,
         status,
         due_date,
         payment_url,
         notes,
         invoice_type,
         total_project_amount,
         deposit_percent,
         parent_invoice_id,
         balance_due_amount,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      leadId,
      invoiceNumber,
      safeAmount,
      status,
      dueDate || null,
      paymentUrl || null,
      notes || null,
      invoiceType,
      totalProjectAmount,
      safeDepositPercent,
      parentInvoiceId,
      balanceDueAmount,
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
