import { getAuthenticatedClient } from "../client/_auth.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    let leadId = url.searchParams.get("leadId");

    if (!leadId) {
      const account = await getAuthenticatedClient(request, env);
      leadId = account?.lead_id ? String(account.lead_id) : "";
    }

    if (!leadId) {
      return json({ ok: false, error: "Missing lead ID." }, 400);
    }

    const result = await env.DB.prepare(`
      SELECT *
      FROM project_files
      WHERE lead_id = ?
      ORDER BY created_at DESC, id DESC
    `).bind(leadId).all();

    return json({
      ok: true,
      files: result.results || []
    });
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load files." },
      500
    );
  }
}