export async function onRequestGet({ env }) {
  const result = await env.DB.prepare(
    "SELECT * FROM service_packages ORDER BY id DESC"
  ).all();

  return new Response(JSON.stringify({
    ok: true,
    packages: result.results || []
  }), {
    headers: { "Content-Type": "application/json" }
  });
}