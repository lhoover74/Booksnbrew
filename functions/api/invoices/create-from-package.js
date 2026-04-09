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

    const amount = pkg.price;
    const deposit = pkg.deposit_percent > 0
      ? (amount * pkg.deposit_percent) / 100
      : amount;

    const invoiceNumber = "INV-" + Date.now();

    await env.DB.prepare(`
      INSERT INTO invoices (lead_id, invoice_number, amount, status, notes, created_at)
      VALUES (?, ?, ?, 'Draft', ?, ?)
    `).bind(
      leadId,
      invoiceNumber,
      deposit,
      pkg.description,
      new Date().toISOString()
    ).run();

    return json({
      ok: true,
      message: "Invoice created from package"
    });

  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}