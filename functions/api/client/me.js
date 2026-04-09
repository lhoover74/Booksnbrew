import { getAuthenticatedClient } from "./_auth.js";

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
    parent_invoice_id: invoice.parent_invoice_id ?? null,
    balance_due_amount: invoice.balance_due_amount ?? 0
  };
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const account = await getAuthenticatedClient(request, env);

    if (!account) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const leadId = account.lead_id;

    const lead = await env.DB.prepare(
      `SELECT * FROM leads WHERE id = ? LIMIT 1`
    ).bind(leadId).first();

    if (!lead) {
      return json({ ok: false, error: "Lead not found." }, 404);
    }

    const project = await env.DB.prepare(
      `SELECT * FROM client_projects WHERE lead_id = ? LIMIT 1`
    ).bind(leadId).first();

    const notesResult = await env.DB.prepare(
      `SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY id DESC`
    ).bind(leadId).all();

    const remindersResult = await env.DB.prepare(
      `SELECT * FROM lead_reminders WHERE lead_id = ? ORDER BY remind_at ASC`
    ).bind(leadId).all();

    const messagesResult = await env.DB.prepare(
      `SELECT * FROM project_messages WHERE lead_id = ? ORDER BY id DESC`
    ).bind(leadId).all();

    const invoicesResult = await env.DB.prepare(
      `SELECT *
       FROM invoices
       WHERE lead_id = ?
       ORDER BY created_at DESC, id DESC`
    ).bind(leadId).all();

    const filesResult = await env.DB.prepare(
      `SELECT * FROM project_files WHERE lead_id = ? ORDER BY id DESC`
    ).bind(leadId).all();

    return json({
      ok: true,
      lead,
      project: project || null,
      notes: notesResult.results || [],
      reminders: remindersResult.results || [],
      messages: messagesResult.results || [],
      invoices: (invoicesResult.results || []).map(normalizeInvoice),
      files: filesResult.results || [],
      account: {
        id: account.id,
        email: account.email,
        must_change_password: Number(account.must_change_password || 0) === 1
      }
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load portal." },
      500
    );
  }
}