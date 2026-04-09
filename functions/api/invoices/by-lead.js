function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function normalizeInvoice(invoice) {
  return {
    ...invoice,
    invoice_type: invoice.invoice_type || "full",
    total_project_amount: invoice.total_project_amount ?? invoice.amount ?? 0,
    deposit_percent: invoice.deposit_percent ?? 0,
    balance_due_amount: invoice.balance_due_amount ?? 0,
    parent_invoice_id: invoice.parent_invoice_id ?? null
  };
}

export async function onRequestGet(context) {
  try {
    const { env, request } = context;
    const url = new URL(request.url);
    const leadId = url.searchParams.get("leadId");

    if (!leadId) {
      return json({ ok: false, error: "leadId is required." }, 400);
    }

    const result = await env.DB.prepare(
      `SELECT *
       FROM invoices
       WHERE lead_id = ?
       ORDER BY created_at DESC, id DESC`
    ).bind(leadId).all();

    const invoices = (result.results || []).map(normalizeInvoice);

    return json({ ok: true, invoices });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load invoices." },
      500
    );
  }
}
