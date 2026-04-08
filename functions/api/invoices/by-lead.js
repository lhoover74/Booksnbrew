function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
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
      `SELECT * FROM invoices WHERE lead_id = ? ORDER BY id DESC`
    ).bind(leadId).all();

    return json({ ok: true, invoices: result.results || [] });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load invoices." },
      500
    );
  }
}
