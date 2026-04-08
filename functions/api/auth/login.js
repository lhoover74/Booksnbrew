async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const form = await request.formData();
  const password = (form.get('password') || '').toString();

  if (!env.ADMIN_PASSWORD || password !== env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ ok: false }), { status: 401 });
  }

  const token = await sha256(`${env.ADMIN_PASSWORD}|${env.ADMIN_SESSION_SECRET}`);

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Set-Cookie': `bb_admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      'Content-Type': 'application/json'
    }
  });
}
