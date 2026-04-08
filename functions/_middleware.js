function parseCookies(cookieHeader) {
  const cookies = {};
  (cookieHeader || '').split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index === -1) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = value;
  });
  return cookies;
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function expectedToken(env) {
  return sha256(`${env.ADMIN_PASSWORD || ''}|${env.ADMIN_SESSION_SECRET || ''}`);
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const protectedAdmin = path.startsWith('/admin') && !path.startsWith('/admin/login');
  const protectedApi = path.startsWith('/api/leads');

  if (!protectedAdmin && !protectedApi) {
    return next();
  }

  const cookies = parseCookies(request.headers.get('Cookie'));
  const token = cookies.bb_admin_session;
  const validToken = await expectedToken(env);
  const authenticated = Boolean(token && validToken && token === validToken);

  if (authenticated) {
    return next();
  }

  if (protectedApi) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return Response.redirect(`${url.origin}/admin/login.html`, 302);
}
