function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function createInvoiceNumber() {
  const random = Math.floor(Math.random() * 900 + 100);
  return `INV-${Date.now()}-B${random}`;
}

function packageLabel(invoice) {
  const text = (invoice.notes || "").trim();
  if (!text) {
    return "project";
  }

  if (text.toLowerCase().startsWith("deposit invoice for ")) {
    return text.slice("deposit invoice for ".length).trim() || "project";
  }

  return text;
}

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const depositInvoiceId = (form.get("depositInvoiceId") || "").toString().trim();
    const leadId = (form.get("leadId") || "").toString().trim();

    if (!depositInvoiceId && !leadId) {
      return json({ ok: false, error: "depositInvoiceId or leadId is required." }, 400);
    }

    let depositInvoice = null;

    if (depositInvoiceId) {
      depositInvoice = await env.DB.prepare(
        `SELECT * FROM invoices WHERE id = ? LIMIT 1`
      ).bind(depositInvoiceId).first();
    } else {
      depositInvoice = await env.DB.prepare(
        `SELECT *
         FROM invoices
         WHERE lead_id = ?
           AND invoice_type = 'deposit'
         ORDER BY created_at DESC, id DESC
         LIMIT 1`
      ).bind(leadId).first();
    }

    if (!depositInvoice) {
      return json({ ok: false, error: "Deposit invoice not found." }, 404);
    }

    const invoiceType = (depositInvoice.invoice_type || "full").toLowerCase();
    if (invoiceType !== "deposit") {
      return json({ ok: false, error: "Balance invoices can only be created from a deposit invoice." }, 400);
    }

    if ((depositInvoice.status || "").toLowerCase() !== "paid") {
      return json({ ok: false, error: "Deposit invoice must be paid before creating a balance invoice." }, 400);
    }

    const totalProjectAmount = roundMoney(
      depositInvoice.total_project_amount ??
      0
    );
    const depositAmount = roundMoney(depositInvoice.amount || 0);

    let remaining = roundMoney(
      depositInvoice.balance_due_amount ??
      (totalProjectAmount - depositAmount)
    );

    if (remaining < 0) {
      remaining = 0;
    }

    if (remaining <= 0) {
      return json({ ok: false, error: "Remaining balance is zero; no balance invoice can be created." }, 400);
    }

    const existingBalance = await env.DB.prepare(
      `SELECT id
       FROM invoices
       WHERE parent_invoice_id = ?
          OR (
            lead_id = ?
            AND invoice_type = 'balance'
            AND ABS(COALESCE(total_project_amount, 0) - ?) < 0.01
          )
       LIMIT 1`
    ).bind(
      depositInvoice.id,
      depositInvoice.lead_id,
      totalProjectAmount
    ).first();

    if (existingBalance) {
      return json({ ok: false, error: "A remaining balance invoice already exists for this project." }, 409);
    }

    const packageName = packageLabel(depositInvoice);
    const note = `Remaining balance for ${packageName}`;
    const invoiceNumber = createInvoiceNumber();
    const now = new Date().toISOString();

    const insertResult = await env.DB.prepare(
      `INSERT INTO invoices
       (
         lead_id,
         invoice_number,
         amount,
         status,
         notes,
         invoice_type,
         total_project_amount,
         deposit_percent,
         parent_invoice_id,
         balance_due_amount,
         due_date,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, 'Draft', ?, 'balance', ?, ?, ?, 0, ?, ?, ?)`
    ).bind(
      depositInvoice.lead_id,
      invoiceNumber,
      remaining,
      note,
      totalProjectAmount || null,
      depositInvoice.deposit_percent ?? null,
      depositInvoice.id,
      depositInvoice.due_date || null,
      now,
      now
    ).run();

    return json({
      ok: true,
      message: "Remaining balance invoice created.",
      invoice: {
        id: insertResult.meta?.last_row_id || null,
        invoice_number: invoiceNumber,
        invoice_type: "balance",
        amount: remaining,
        parent_invoice_id: depositInvoice.id,
        total_project_amount: totalProjectAmount,
        balance_due_amount: 0
      }
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create balance invoice." },
      500
    );
  }
}
