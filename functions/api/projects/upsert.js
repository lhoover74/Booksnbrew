function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();

    const leadId = (form.get("leadId") || "").toString().trim();
    const title = (form.get("title") || "").toString().trim();
    const stage = (form.get("stage") || "Inquiry Received").toString().trim();
    const progress = Number((form.get("progress") || "0").toString());
    const targetDate = (form.get("targetDate") || "").toString().trim();
    const nextMilestone = (form.get("nextMilestone") || "").toString().trim();

    if (!leadId || !title) {
      return json({ ok: false, error: "Lead ID and title are required." }, 400);
    }

    if (Number.isNaN(progress) || progress < 0 || progress > 100) {
      return json({ ok: false, error: "Progress must be between 0 and 100." }, 400);
    }

    const now = new Date().toISOString();

    const existing = await env.DB.prepare(
      `SELECT id FROM client_projects WHERE lead_id = ? LIMIT 1`
    ).bind(leadId).first();

    if (existing) {
      await env.DB.prepare(
        `UPDATE client_projects
         SET title = ?, stage = ?, progress = ?, target_date = ?, next_milestone = ?, updated_at = ?
         WHERE lead_id = ?`
      ).bind(
        title,
        stage,
        progress,
        targetDate || null,
        nextMilestone || null,
        now,
        leadId
      ).run();

      return json({ ok: true, updated: true });
    }

    await env.DB.prepare(
      `INSERT INTO client_projects
       (lead_id, title, stage, progress, target_date, next_milestone, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      leadId,
      title,
      stage,
      progress,
      targetDate || null,
      nextMilestone || null,
      now,
      now
    ).run();

    return json({ ok: true, created: true });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to save project." },
      500
    );
  }
}