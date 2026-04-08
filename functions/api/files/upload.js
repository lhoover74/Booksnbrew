function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function sanitizeFileName(name) {
  return String(name || "file")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

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

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") || "admin";

    const form = await request.formData();
    const file = form.get("file");
    let leadId = (form.get("leadId") || "").toString().trim();
    let uploadedBy = "admin";

    if (!(file instanceof File)) {
      return json({ ok: false, error: "File is required." }, 400);
    }

    if (mode === "client") {
      const cookies = parseCookies(request.headers.get("Cookie"));
      leadId = cookies.bb_client_lead_id || "";
      uploadedBy = "client";
    }

    if (!leadId) {
      return json({ ok: false, error: "Lead ID is required." }, 400);
    }

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      return json({ ok: false, error: "File must be 10MB or less." }, 400);
    }

    const now = new Date().toISOString();
    const safeName = sanitizeFileName(file.name);
    const ext = safeName.includes(".") ? safeName.split(".").pop() : "";
    const uniqueKey = `lead-${leadId}/${Date.now()}-${crypto.randomUUID()}${ext ? "." + ext : ""}`;

    await env.ASSETS.put(uniqueKey, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream"
      }
    });

    const publicBase =
      env.R2_PUBLIC_BASE_URL ||
      `${url.origin}/files`;

    const fileUrl = `${publicBase}/${uniqueKey}`;

    await env.DB.prepare(
      `INSERT INTO project_files
       (lead_id, uploaded_by, file_name, file_key, file_url, file_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      leadId,
      uploadedBy,
      safeName,
      uniqueKey,
      fileUrl,
      file.type || "application/octet-stream",
      now
    ).run();

    return json({
      ok: true,
      file: {
        lead_id: leadId,
        uploaded_by: uploadedBy,
        file_name: safeName,
        file_key: uniqueKey,
        file_url: fileUrl,
        file_type: file.type || "application/octet-stream",
        created_at: now
      }
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Upload failed." },
      500
    );
  }
}
