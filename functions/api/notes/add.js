export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();

    const leadId = (form.get('leadId') || '').toString().trim();
    const note = (form.get('note') || '').toString().trim();

    if (!leadId || !note) {
      return json({ ok: false, error: 'Missing data' }, 400);
    }

    const createdAt = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO lead_notes (lead_id, note, created_at)
      VALUES (?, ?, ?)
    `).bind(leadId, note, createdAt).run();

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
