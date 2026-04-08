export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();
    const id = (form.get('id') || '').toString().trim();
    const status = (form.get('status') || '').toString().trim();

    const allowed = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'];

    if (!id || !status || !allowed.includes(status)) {
      return json({ ok: false, error: 'Invalid lead ID or status.' }, 400);
    }

    const updatedAt = new Date().toISOString();
    const result = await env.DB.prepare(
      'UPDATE leads SET status = ?, updated_at = ? WHERE id = ?'
    ).bind(status, updatedAt, id).run();

    return json({ ok: true, meta: result.meta || null });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Failed to update status' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
