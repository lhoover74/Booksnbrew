export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const formData = await request.formData();

    const formType = (formData.get("formType") || "contact").toString();
    const name = (formData.get("name") || "").toString().trim();
    const email = (formData.get("email") || "").toString().trim();
    const phone = (formData.get("phone") || "").toString().trim();
    const businessName = (formData.get("businessName") || "").toString().trim();
    const projectType = (formData.get("projectType") || "").toString().trim();
    const budgetRange = (formData.get("budgetRange") || "").toString().trim();
    const projectDetails = (formData.get("projectDetails") || "").toString().trim();
    const message = (formData.get("message") || "").toString().trim();

    if (!name || !email) {
      return new Response(
        JSON.stringify({ ok: false, error: "Name and email are required." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const isQuote = formType === "quote";

    const subject = isQuote
      ? `New Quote Request from ${name}`
      : `New Contact Inquiry from ${name}`;

    const html = isQuote
      ? `
        <h2>New Quote Request</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Business Name:</strong> ${escapeHtml(businessName)}</p>
        <p><strong>Project Type:</strong> ${escapeHtml(projectType)}</p>
        <p><strong>Budget Range:</strong> ${escapeHtml(budgetRange)}</p>
        <p><strong>Project Details:</strong><br>${escapeHtml(projectDetails).replace(/\n/g, "<br>")}</p>
      `
      : `
        <h2>New Contact Inquiry</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      `;

    const html = isQuote
  ? `
  <div style="background:#0b0b0c;padding:30px;font-family:Arial,sans-serif;color:#f5ede3;">
    <div style="max-width:600px;margin:auto;background:#151515;border-radius:12px;padding:24px;">
      
      <h2 style="color:#c79058;margin-bottom:10px;">New Quote Request</h2>
      <p style="color:#d6c6b8;margin-bottom:20px;">You have received a new project inquiry.</p>

      <div style="line-height:1.8;">
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Business:</strong> ${escapeHtml(businessName)}</p>
        <p><strong>Project Type:</strong> ${escapeHtml(projectType)}</p>
        <p><strong>Budget:</strong> ${escapeHtml(budgetRange)}</p>
        <p><strong>Details:</strong><br>${escapeHtml(projectDetails).replace(/\n/g, "<br>")}</p>
      </div>

    </div>
  </div>
  `
  : `
  <div style="background:#0b0b0c;padding:30px;font-family:Arial,sans-serif;color:#f5ede3;">
    <div style="max-width:600px;margin:auto;background:#151515;border-radius:12px;padding:24px;">
      
      <h2 style="color:#c79058;margin-bottom:10px;">New Contact Inquiry</h2>
      <p style="color:#d6c6b8;margin-bottom:20px;">You have received a new message.</p>

      <div style="line-height:1.8;">
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Message:</strong><br>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      </div>

    </div>
  </div>
  `;

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: resendData }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    return Response.redirect("https://booksnbrew.pages.dev/thank-you.html", 302);
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

function escapeHtml(str) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}