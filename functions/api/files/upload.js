export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const leadId = formData.get("leadId");

    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), { status: 400 });
    }

    const key = `lead-${leadId}/${Date.now()}-${file.name}`;

    await env.ASSETS.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type
      }
    });

    return new Response(JSON.stringify({
      ok: true,
      key,
      url: `${env.R2_PUBLIC_BASE_URL}/${key}`
    }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
