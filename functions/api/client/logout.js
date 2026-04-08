export async function onRequestPost() {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.append(
    "Set-Cookie",
    "bb_client_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
  );
  headers.append(
    "Set-Cookie",
    "bb_client_lead_id=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
  );

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers
  });
}