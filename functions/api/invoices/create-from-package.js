function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();

    const leadId = form.get("leadId");
    const packageId = form.get("packageId");

    if (!leadId || !packageId) {
      return json({ ok: false, error: "Missing data" }, 400);
    }

    const pkg = await env.DB.prepare(
      "SELECT * FROM service_packages WHERE id = ?"
    ).bind(packageId).first();

    if (!pkg) {
      return json({ ok: false, error: "Package not found" }, 404);
    }

    const total = Number(pkg.price || 0);
    const depositPercent = Number(pkg.deposit_percent || 0);

    const now = new Date().toISOString();
    const invoiceNumber = "INV-" + Date.now();

    // 🔥 MAIN LOGIC
    let amount = total;
    let invoiceType = "full";
    let balanceDue = 0;

    if (depositPercent > 0) {
      amount = Number(((total * depositPercent) / 100).toFixed(2));
      invoiceType = "deposit";
      balanceDue = Number((total - amount).toFixed(2));
    }

    await env.DB.prepare(`
      INSERT INTO invoices (
        lead_id,
        invoice_number,
        amount,
        status,
        notes,
        invoice_type,
        total_project_amount,
        deposit_percent,
        balance_due_amount,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      leadId,
      invoiceNumber,
      amount,
      "Draft",
      pkg.description,
      invoiceType,
      total,
      depositPercent,
      balanceDue,
      now,
      now
    ).run();

    return json({
      ok: true,
      message: "Invoice created from package"
    });

  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}