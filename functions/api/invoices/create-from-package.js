function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function safePercent(value) {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return numeric;
}

function createInvoiceNumber(suffix) {
  const random = Math.floor(Math.random() * 900 + 100);
  return `INV-${Date.now()}-${suffix}${random}`;
}

function packageLabel(pkg) {
  return (
    pkg.name ||
    pkg.title ||
    pkg.description ||
    `Package ${pkg.id}`
  );
}

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();

    const leadId = (form.get("leadId") || "").toString().trim();
    const packageId = (form.get("packageId") || "").toString().trim();

    if (!leadId || !packageId) {
      return json({ ok: false, error: "leadId and packageId are required." }, 400);
    }

    const pkg = await env.DB.prepare(
      "SELECT * FROM service_packages WHERE id = ? LIMIT 1"
    ).bind(packageId).first();

    if (!pkg) {
      return json({ ok: false, error: "Package not found." }, 404);
    }

    const totalProjectAmount = roundMoney(pkg.price || 0);
    if (totalProjectAmount <= 0) {
      return json({ ok: false, error: "Package price must be greater than 0." }, 400);
    }

    const depositPercent = safePercent(pkg.deposit_percent);
    const now = new Date().toISOString();
    const label = packageLabel(pkg);

    if (depositPercent > 0) {
      const depositAmount = roundMoney((totalProjectAmount * depositPercent) / 100);
      const balanceDueAmount = roundMoney(totalProjectAmount - depositAmount);
      const invoiceNumber = createInvoiceNumber("D");

      const result = await env.DB.prepare(
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
           created_at,
           updated_at
         )
         VALUES (?, ?, ?, 'Draft', ?, 'deposit', ?, ?, NULL, ?, ?, ?)`
      ).bind(
        leadId,
        invoiceNumber,
        depositAmount,
        `Deposit invoice for ${label}`,
        totalProjectAmount,
        depositPercent,
        balanceDueAmount,
        now,
        now
      ).run();

      return json({
        ok: true,
        message: "Deposit invoice created from package.",
        invoice: {
          id: result.meta?.last_row_id || null,
          invoice_number: invoiceNumber,
          invoice_type: "deposit",
          amount: depositAmount,
          total_project_amount: totalProjectAmount,
          deposit_percent: depositPercent,
          balance_due_amount: balanceDueAmount
        }
      });
    }

    const invoiceNumber = createInvoiceNumber("F");
    const fullResult = await env.DB.prepare(
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
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, 'Draft', ?, 'full', ?, 0, NULL, 0, ?, ?)`
    ).bind(
      leadId,
      invoiceNumber,
      totalProjectAmount,
      `Full invoice for ${label}`,
      totalProjectAmount,
      now,
      now
    ).run();

    return json({
      ok: true,
      message: "Full invoice created from package.",
      invoice: {
        id: fullResult.meta?.last_row_id || null,
        invoice_number: invoiceNumber,
        invoice_type: "full",
        amount: totalProjectAmount,
        total_project_amount: totalProjectAmount,
        deposit_percent: 0,
        balance_due_amount: 0
      }
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create invoice from package." },
      500
    );
  }
}