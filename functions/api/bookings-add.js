export async function onRequestPost(context) {
  const { request, env } = context;
  const form = await request.formData();

  const leadId = form.get("leadId");
  const name = form.get("name");
  const email = form.get("email");
  const date = form.get("date");
  const notes = form.get("notes");

  if (!name || !email || !date) {
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  }

  await env.DB.prepare(`
    INSERT INTO lead_bookings (lead_id, name, email, date, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    leadId || null,
    name,
    email,
    date,
    notes || null,
    new Date().toISOString()
  ).run();

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}