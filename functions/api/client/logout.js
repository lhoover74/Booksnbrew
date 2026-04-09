import { buildLogoutCookies, getAuthenticatedClient } from "./_auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const account = await getAuthenticatedClient(request, env);
  if (account) {
    await env.DB.prepare(
      `UPDATE client_accounts
       SET session_token_hash = NULL,
           session_expires_at = NULL,
           updated_at = ?
       WHERE id = ?`
    ).bind(new Date().toISOString(), account.id).run();
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  buildLogoutCookies().forEach((cookie) => headers.append("Set-Cookie", cookie));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers
  });
}