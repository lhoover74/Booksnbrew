export async function onRequestGet(context) {
  const { env, params } = context;

  const key = Array.isArray(params.key)
    ? params.key.join("/")
    : params.key;

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.ASSETS.get(key);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);

  return new Response(object.body, { headers });
}
