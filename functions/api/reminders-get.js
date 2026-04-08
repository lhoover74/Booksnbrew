export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const leadId = url.searchParams.get('leadId');

  const result = await env.DB.prepare(
    'SELECT * FROM lead_reminders WHERE lead_id = ? ORDER BY remind_at ASC'
  ).bind(leadId).all();

  return new Response(JSON.stringify({ reminders: result.results || [] }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
