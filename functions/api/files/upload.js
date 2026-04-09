import { getAuthenticatedClient } from "../client/_auth.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function sanitizeFileName(name) {
  return String(name || "file")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const formData = await request.formData();

    const uploaded = formData.get("file");

    if (!uploaded || typeof uploaded === "string") {
      return json({ ok: false, error: "File is required." }, 400);
    }

    let leadId = (formData.get("leadId") || "").toString().trim();
    let uploadedBy = "admin";

    const mode = url.searchParams.get("mode") || "admin";

    if (mode === "client") {
      const account = await getAuthenticatedClient(request, env);
      if (!account) {
        return json({ ok: false, error: "Unauthorized" }, 401);
      }
      leadId = String(account.lead_id || "");
      uploadedBy = "client";
    }

    if (!leadId) {
      return json({ ok: false, error: "Missing lead ID." }, 400);
    }

    const file = uploaded;
    const maxBytes = 10 * 1024 * 1024;

    if ((file.size || 0) > maxBytes) {
      return json({ ok: false, error: "Max file size is 10MB." }, 400);
    }

    const safeName = sanitizeFileName(file.name || "file");
    const ext = safeName.includes(".") ? safeName.split(".").pop() : "";
    const key = `lead-${leadId}-${Date.now()}-${crypto.randomUUID()}${ext ? "." + ext : ""}`;

    await env.FILES_BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream"
      }
    });

    const base = env.R2_PUBLIC_BASE_URL || `${url.origin}/files`;
    const fileUrl = `${base}/${key}`;
    const now = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO project_files
      (lead_id, uploaded_by, file_name, file_key, file_url, file_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      leadId,
      uploadedBy,
      safeName,
      key,
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
        file_key: key,
        file_url: fileUrl,
        file_type: file.type || "application/octet-stream",
        created_at: now
      }
    });
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : "Upload failed." },
      500
    );
  }
}