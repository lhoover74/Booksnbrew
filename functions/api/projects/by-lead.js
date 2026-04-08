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

    const project = await env.DB.prepare(
      `SELECT * FROM client_projects WHERE lead_id = ? LIMIT 1`
    ).bind(leadId).first();

    return json({ ok: true, project: project || null });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load project." },
      500
    );
  }
}