import { getAuthenticatedClient, parseCookies, sha256Hex } from "./api/client/_auth.js";

async function expectedAdminToken(env) {
  return sha256Hex(`${env.ADMIN_PASSWORD || ""}|${env.ADMIN_SESSION_SECRET || ""}`);
}

function unauthorizedJson() {
  return new Response(
    JSON.stringify({ ok: false, error: "Unauthorized" }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" }
    }
  );
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const cookies = parseCookies(request.headers.get("Cookie"));

  const isAdminPage = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");

  const isAdminApi =
    pathname.startsWith("/api/leads") ||
    pathname.startsWith("/api/notes") ||
    pathname.startsWith("/api/reminders") ||
    pathname.startsWith("/api/bookings") ||
    pathname.startsWith("/api/projects") ||
    pathname.startsWith("/api/messages") ||
    pathname.startsWith("/api/invoices") ||
    pathname.startsWith("/api/stripe/create-checkout-session") ||
    pathname.startsWith("/api/client/create-account") ||
    pathname.startsWith("/api/client/send-invite") ||
    pathname.startsWith("/api/client/send-update") ||
    pathname.startsWith("/api/files/delete") ||
    pathname.startsWith("/api/files/notify-upload");

  const isClientPage = pathname === "/client/portal.html";

  const isClientProtectedApi =
    pathname.startsWith("/api/client/me") ||
    pathname.startsWith("/api/client/change-password") ||
    pathname.startsWith("/api/client/reply") ||
    pathname.startsWith("/api/client/logout");

  const isOpenClientAuthApi =
    pathname.startsWith("/api/client/login") ||
    pathname.startsWith("/api/client/request-reset") ||
    pathname.startsWith("/api/client/reset-password");

  const isSharedFileApi =
    pathname.startsWith("/api/files/upload") ||
    pathname.startsWith("/api/files/by-lead");

  const isPublicFileRoute = pathname.startsWith("/files/");

  if (isPublicFileRoute || isOpenClientAuthApi) {
    return next();
  }

  const validAdminToken = await expectedAdminToken(env);
  const adminAuthenticated = Boolean(
    cookies.bb_admin_session &&
    validAdminToken &&
    cookies.bb_admin_session === validAdminToken
  );

  let clientAccount = null;
  if (isClientPage || isClientProtectedApi || isSharedFileApi) {
    clientAccount = await getAuthenticatedClient(request, env);
  }

  if (isAdminPage || isAdminApi) {
    if (!adminAuthenticated) {
      if (isAdminApi) {
        return unauthorizedJson();
      }
      return Response.redirect(`${url.origin}/admin/login.html`, 302);
    }
  }

  if (isClientPage || isClientProtectedApi) {
    if (!clientAccount) {
      if (isClientProtectedApi) {
        return unauthorizedJson();
      }
      return Response.redirect(`${url.origin}/client/login.html`, 302);
    }
  }

  if (isSharedFileApi) {
    if (!adminAuthenticated && !clientAccount) {
      return unauthorizedJson();
    }
  }

  return next();
}