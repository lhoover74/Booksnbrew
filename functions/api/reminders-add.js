export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();
    const leadId = (form.get('leadId') || '').toString().trim();
    const remindAt = (form.get('remindAt') || '').toString().trim();
    const note = (form.get('note') || '').toString().trim();

    if (!leadId || !remindAt) {
      return json({ ok: false, error: 'Missing leadId or remindAt' }, 400);
    }

    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      'INSERT INTO lead_reminders (lead_id, remind_at, note, created_at) VALUES (?, ?, ?, ?)'
    ).bind(leadId, remindAt, note || null, createdAt).run();

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Failed to save reminder' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
