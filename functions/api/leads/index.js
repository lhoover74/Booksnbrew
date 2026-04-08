export async function onRequestGet(context) {
  try {
    const { env } = context;

    const result = await env.DB.prepare(
      `SELECT * FROM leads ORDER BY id DESC LIMIT 100`
    ).all();

    return new Response(JSON.stringify({ leads: result.results || [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to load leads' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}