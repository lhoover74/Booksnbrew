function textToBytes(text) {
  return new TextEncoder().encode(text);
}

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function toBase64Url(bytes) {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export function parseCookies(cookieHeader) {
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

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", textToBytes(text));
  return bytesToHex(new Uint8Array(digest));
}

async function pbkdf2(password, saltBytes, iterations = 100000) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    textToBytes(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );

  return new Uint8Array(hash);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;
  const hashBytes = await pbkdf2(password, salt, iterations);
  return `pbkdf2$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hashBytes)}`;
}

export async function verifyPassword(password, storedHash) {
  const value = String(storedHash || "");

  if (value.startsWith("pbkdf2$")) {
    const parts = value.split("$");
    if (parts.length !== 4) return false;

    const iterations = Number(parts[1]);
    if (!iterations || Number.isNaN(iterations)) return false;

    const salt = base64ToBytes(parts[2]);
    const expected = base64ToBytes(parts[3]);
    const actual = await pbkdf2(password, salt, iterations);
    return timingSafeEqual(actual, expected);
  }

  // Backward compatibility for legacy SHA-256 hashes.
  const incomingLegacy = await sha256Hex(password);
  return incomingLegacy === value;
}

export function buildSessionCookies(token, account) {
  return [
    `bb_client_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    `bb_client_account_id=${account.id}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    `bb_client_lead_id=${account.lead_id}; Path=/; HttpOnly; Secure; SameSite=Lax`
  ];
}

export function buildLogoutCookies() {
  return [
    "bb_client_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    "bb_client_account_id=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    "bb_client_lead_id=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
  ];
}

export async function createClientSession(env, account, days = 7) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = toBase64Url(tokenBytes);
  const tokenHash = await sha256Hex(`${token}|${env.CLIENT_SESSION_SECRET || ""}`);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();

  await env.DB.prepare(
    `UPDATE client_accounts
     SET session_token_hash = ?,
         session_expires_at = ?,
         last_login_at = ?,
         updated_at = ?
     WHERE id = ?`
  ).bind(tokenHash, expiresAt, nowIso, nowIso, account.id).run();

  return {
    token,
    expiresAt
  };
}

export async function getAuthenticatedClient(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const sessionToken = cookies.bb_client_session || "";
  const accountId = cookies.bb_client_account_id || "";

  if (!sessionToken || !accountId) {
    return null;
  }

  const account = await env.DB.prepare(
    `SELECT * FROM client_accounts WHERE id = ? LIMIT 1`
  ).bind(accountId).first();

  if (!account) {
    return null;
  }

  if (Number(account.is_active || 1) !== 1) {
    return null;
  }

  if (!account.session_token_hash || !account.session_expires_at) {
    return null;
  }

  const expiresAt = new Date(account.session_expires_at).getTime();
  if (!expiresAt || Number.isNaN(expiresAt) || expiresAt < Date.now()) {
    return null;
  }

  const incomingHash = await sha256Hex(`${sessionToken}|${env.CLIENT_SESSION_SECRET || ""}`);
  if (incomingHash !== account.session_token_hash) {
    return null;
  }

  return account;
}
