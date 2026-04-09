function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();

    const leadId = (form.get("leadId") || "").toString().trim();
    const packageId = (form.get("packageId") || "").toString().trim();

    if (!leadId || !packageId) {
      return json({ ok: false, error: "Missing data." }, 400);
    }

    const pkg = await env.DB.prepare(
      `SELECT * FROM service_packages WHERE id = ? LIMIT 1`
    ).bind(packageId).first();

    if (!pkg) {
      return json({ ok: false, error: "Package not found." }, 404);
    }

    const amount = Number(pkg.price || 0);
    const depositPercent = Number(pkg.deposit_percent || 0);
    const depositAmount =
      depositPercent > 0 ? Number(((amount * depositPercent) / 100).toFixed(2)) : amount;

    const now = new Date().toISOString();
    const invoiceNumber = `INV-${Date.now()}`;

    await env.DB.prepare(`
      INSERT INTO invoices (
        lead_id,
        invoice_number,
        amount,
        status,
        notes,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      leadId,
      invoiceNumber,
      depositAmount,
      "Draft",
      pkg.description || pkg.name || "Package invoice",
      now,
      now
    ).run();

    return json({
      ok: true,
      message: "Invoice created from package.",
      invoice: {
        invoice_number: invoiceNumber,
        amount: depositAmount
      }
    });
  } catch (e) {
    return json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to create invoice." },
      500
    );
  }
}