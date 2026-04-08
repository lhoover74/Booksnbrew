function parseCookies(cookieHeader) {
  const cookies = {};
  (cookieHeader || "").split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index === -1) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = value;
  });
  return cookies;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const cookies = parseCookies(request.headers.get("Cookie"));
    const leadId = cookies.bb_client_lead_id;

    if (!leadId) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const lead = await env.DB.prepare(
      `SELECT * FROM leads WHERE id = ? LIMIT 1`
    )
      .bind(leadId)
      .first();

    if (!lead) {
      return json({ ok: false, error: "Lead not found." }, 404);
    }

    const notesResult = await env.DB.prepare(
      `SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY id DESC`
    )
      .bind(leadId)
      .all();

    const remindersResult = await env.DB.prepare(
      `SELECT * FROM lead_reminders WHERE lead_id = ? ORDER BY remind_at ASC`
    )
      .bind(leadId)
      .all();

    return json({
      ok: true,
      lead,
      notes: notesResult.results || [],
      reminders: remindersResult.results || []
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load portal." },
      500
    );
  }
}