export async function onRequestPost() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Set-Cookie': 'bb_admin_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
      'Content-Type': 'application/json'
    }
  });
}
