export async function onRequestGet(context) {
  try {
    const { env, params } = context;
    const id = params.id;

    const result = await env.DB.prepare(
      `SELECT * FROM leads WHERE id = ?`
    ).bind(id).first();

    return new Response(JSON.stringify({ lead: result || null }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to load lead' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}