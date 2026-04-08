function parseCookies(cookieHeader) {
  const cookies = {};
  (cookieHeader || "").split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index === -1) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) cookies[key] = value;
  });
  return cookies;
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function expectedAdminToken(env) {
  return sha256(`${env.ADMIN_PASSWORD || ""}|${env.ADMIN_SESSION_SECRET || ""}`);
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const cookies = parseCookies(request.headers.get("Cookie"));

  const protectAdminPage =
    path.startsWith("/admin") && !path.startsWith("/admin/login");

  const protectAdminApi =
  path.startsWith("/api/leads") ||
  path.startsWith("/api/notes") ||
  path.startsWith("/api/reminders") ||
  path.startsWith("/api/bookings") ||
  path.startsWith("/api/projects") ||
  path.startsWith("/api/messages") ||
  path.startsWith("/api/invoices") ||
  path.startsWith("/api/files") ||
  path.startsWith("/api/client/create-account") ||
  path.startsWith("/api/client/send-invite") ||
  path.startsWith("/api/client/send-update");

const protectClientApi =
  path.startsWith("/api/client/me") ||
  path.startsWith("/api/client/change-password") ||
  path.startsWith("/api/client/reply") ||
  path.startsWith("/api/files/upload");

  const protectClientPage =
    path === "/client/portal.html";

  const protectClientApi =
    path.startsWith("/api/client/me") ||
    path.startsWith("/api/client/change-password");
    path.startsWith("/api/client/reply")
  if (protectAdminPage || protectAdminApi) {
    const adminToken = cookies.bb_admin_session;
    const validAdminToken = await expectedAdminToken(env);
    const adminAuthenticated = Boolean(
      adminToken && validAdminToken && adminToken === validAdminToken
    );

    if (!adminAuthenticated) {
      if (protectAdminApi) {
        return new Response(
          JSON.stringify({ ok: false, error: "Unauthorized" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return Response.redirect(`${url.origin}/admin/login.html`, 302);
    }
  }

  if (protectClientPage || protectClientApi) {
    const clientToken = cookies.bb_client_session;
    const clientLeadId = cookies.bb_client_lead_id;

    if (!clientToken || !clientLeadId) {
      if (protectClientApi) {
        return new Response(
          JSON.stringify({ ok: false, error: "Unauthorized" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      return Response.redirect(`${url.origin}/client/login.html`, 302);
    }
  }

  return next();
}
