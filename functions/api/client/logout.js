function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}

export async function onRequestPost() {
  return json(
    { ok: true },
    200,
    {
      "Set-Cookie": [
        "bb_client_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
        "bb_client_lead_id=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
      ].join(", ")
    }
  );
}