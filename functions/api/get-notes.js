export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const leadId = url.searchParams.get('leadId');

  const result = await env.DB.prepare(
    'SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY id DESC'
  ).bind(leadId).all();

  return new Response(JSON.stringify({ notes: result.results || [] }), {
    headers: { 'Content-Type': 'application/json' }
  });
}