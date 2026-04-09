export async function onRequest(context) {
  const { request, env, params } = context;

  const key = params.key;

  if (!key) {
    return new Response("Missing file key", { status: 400 });
  }

  const object = await env.ASSETS.get(key);

  if (!object) {
    return new Response("File not found", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000"
    }
  });
}
