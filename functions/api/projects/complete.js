function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();

    const leadId = (form.get("leadId") || "").toString().trim();
    const finalMessage = (form.get("finalMessage") || "").toString().trim();
    const maintenanceOffer = (form.get("maintenanceOffer") || "").toString().trim();

    if (!leadId) {
      return json({ ok: false, error: "Lead ID is required." }, 400);
    }

    const lead = await env.DB.prepare(
      `SELECT * FROM leads WHERE id = ? LIMIT 1`
    ).bind(leadId).first();

    if (!lead) {
      return json({ ok: false, error: "Lead not found." }, 404);
    }

    const project = await env.DB.prepare(
      `SELECT * FROM client_projects WHERE lead_id = ? LIMIT 1`
    ).bind(leadId).first();

    if (!project) {
      return json({ ok: false, error: "Project not found." }, 404);
    }

    const now = new Date().toISOString();

    await env.DB.prepare(
      `UPDATE client_projects
       SET stage = 'Complete',
           progress = 100,
           completed_at = ?,
           final_message = ?,
           handoff_status = 'Delivered',
           maintenance_offer = ?,
           updated_at = ?
       WHERE lead_id = ?`
    ).bind(
      now,
      finalMessage || "Your project has been completed and delivered.",
      maintenanceOffer || "Ongoing maintenance and support are available if needed.",
      now,
      leadId
    ).run();

    await env.DB.prepare(
      `UPDATE leads
       SET status = 'Won'
       WHERE id = ?`
    ).bind(leadId).run();

    return json({
      ok: true,
      completed: true,
      completedAt: now
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to complete project." },
      500
    );
  }
}