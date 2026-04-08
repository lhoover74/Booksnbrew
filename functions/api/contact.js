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
      return jsonResponse(
        { ok: false, error: "Name and email are required." },
        400
      );
    }

    const isQuote = formType === "quote";
    const submittedAt = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    });

    const subject = isQuote
      ? `New Quote Request • ${name}`
      : `New Contact Inquiry • ${name}`;

    const adminHtml = isQuote
      ? getAdminQuoteEmail({
          name,
          email,
          phone,
          businessName,
          projectType,
          budgetRange,
          projectDetails,
          submittedAt
        })
      : getAdminContactEmail({
          name,
          email,
          phone,
          message,
          submittedAt
        });

    const autoReplySubject = isQuote
      ? "We received your quote request • Books and Brews"
      : "We received your message • Books and Brews";

    const autoReplyHtml = isQuote
      ? getCustomerQuoteReply({
          name,
          businessName,
          projectType,
          budgetRange
        })
      : getCustomerContactReply({ name });

    // 1. Send lead email to you
    const adminSend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Books and Brews <quotes@booksnbrew.govdirect.org>",
        to: ["michael@govdirect.org"],
        subject,
        html: adminHtml,
        replyTo: email
      })
    });

    const adminData = await adminSend.json();

    if (!adminSend.ok) {
      return jsonResponse(
        {
          ok: false,
          error: adminData
        },
        500
      );
    }

    // 2. Send auto reply to the visitor
    const customerSend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Books and Brews <quotes@booksnbrew.govdirect.org>",
        to: [email],
        subject: autoReplySubject,
        html: autoReplyHtml,
        replyTo: "michael@govdirect.org"
      })
    });

    const customerData = await customerSend.json();

    if (!customerSend.ok) {
      return jsonResponse(
        {
          ok: false,
          error: customerData
        },
        500
      );
    }

    return Response.redirect("https://booksnbrew.pages.dev/thank-you.html", 302);
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      500
    );
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function getAdminContactEmail({ name, email, phone, message, submittedAt }) {
  return `
  <div style="margin:0;padding:0;background:#0b0b0c;font-family:Inter,Arial,sans-serif;color:#f5ede3;">
    <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
      <div style="background:linear-gradient(180deg,#161313,#100f0f);border:1px solid #2a211d;border-radius:20px;overflow:hidden;">
        
        <div style="padding:28px 28px 18px;border-bottom:1px solid #2a211d;background:radial-gradient(circle at top right, rgba(199,144,88,.20), transparent 35%), linear-gradient(180deg,#1b1716,#121111);">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#d6c6b8;margin-bottom:10px;">Books and Brews</div>
          <h1 style="margin:0;font-size:30px;line-height:1.15;color:#f5ede3;font-family:Georgia,serif;font-weight:700;">
            New Contact Inquiry
          </h1>
          <p style="margin:12px 0 0;color:#d6c6b8;font-size:15px;line-height:1.7;">
            A new website lead just came in through your contact form.
          </p>
        </div>

        <div style="padding:28px;">
          ${infoRow("Name", name)}
          ${infoRow("Email", email)}
          ${infoRow("Phone", phone || "Not provided")}
          ${infoRow("Submitted", submittedAt)}

          <div style="margin-top:22px;padding:18px 18px 16px;background:#121111;border:1px solid #2a211d;border-radius:14px;">
            <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#c79058;margin-bottom:10px;">Message</div>
            <div style="font-size:15px;line-height:1.8;color:#f5ede3;">
              ${escapeHtml(message || "No message provided.").replace(/\n/g, "<br>")}
            </div>
          </div>

          <div style="margin-top:26px;padding:16px 18px;background:rgba(199,144,88,.08);border:1px solid rgba(199,144,88,.24);border-radius:14px;color:#e9d8c8;font-size:14px;line-height:1.7;">
            Reply directly to this email to respond to <strong>${escapeHtml(name)}</strong>.
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

function getAdminQuoteEmail({
  name,
  email,
  phone,
  businessName,
  projectType,
  budgetRange,
  projectDetails,
  submittedAt
}) {
  return `
  <div style="margin:0;padding:0;background:#0b0b0c;font-family:Inter,Arial,sans-serif;color:#f5ede3;">
    <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
      <div style="background:linear-gradient(180deg,#161313,#100f0f);border:1px solid #2a211d;border-radius:20px;overflow:hidden;">
        
        <div style="padding:28px 28px 18px;border-bottom:1px solid #2a211d;background:radial-gradient(circle at top right, rgba(199,144,88,.20), transparent 35%), linear-gradient(180deg,#1b1716,#121111);">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#d6c6b8;margin-bottom:10px;">Books and Brews</div>
          <h1 style="margin:0;font-size:30px;line-height:1.15;color:#f5ede3;font-family:Georgia,serif;font-weight:700;">
            New Quote Request
          </h1>
          <p style="margin:12px 0 0;color:#d6c6b8;font-size:15px;line-height:1.7;">
            A new project inquiry was submitted through your quote form.
          </p>
        </div>

        <div style="padding:28px;">
          ${infoRow("Name", name)}
          ${infoRow("Email", email)}
          ${infoRow("Phone", phone || "Not provided")}
          ${infoRow("Business Name", businessName || "Not provided")}
          ${infoRow("Project Type", projectType || "Not selected")}
          ${infoRow("Budget Range", budgetRange || "Not selected")}
          ${infoRow("Submitted", submittedAt)}

          <div style="margin-top:22px;padding:18px 18px 16px;background:#121111;border:1px solid #2a211d;border-radius:14px;">
            <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#c79058;margin-bottom:10px;">Project Details</div>
            <div style="font-size:15px;line-height:1.8;color:#f5ede3;">
              ${escapeHtml(projectDetails || "No project details provided.").replace(/\n/g, "<br>")}
            </div>
          </div>

          <div style="margin-top:26px;padding:16px 18px;background:rgba(199,144,88,.08);border:1px solid rgba(199,144,88,.24);border-radius:14px;color:#e9d8c8;font-size:14px;line-height:1.7;">
            Reply directly to this email to respond to <strong>${escapeHtml(name)}</strong>.
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

function getCustomerContactReply({ name }) {
  return `
  <div style="margin:0;padding:0;background:#0b0b0c;font-family:Inter,Arial,sans-serif;color:#f5ede3;">
    <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
      <div style="background:linear-gradient(180deg,#161313,#100f0f);border:1px solid #2a211d;border-radius:20px;overflow:hidden;">
        
        <div style="padding:28px 28px 18px;border-bottom:1px solid #2a211d;background:radial-gradient(circle at top right, rgba(199,144,88,.20), transparent 35%), linear-gradient(180deg,#1b1716,#121111);">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#d6c6b8;margin-bottom:10px;">Books and Brews</div>
          <h1 style="margin:0;font-size:30px;line-height:1.15;color:#f5ede3;font-family:Georgia,serif;font-weight:700;">
            Thanks for reaching out
          </h1>
          <p style="margin:12px 0 0;color:#d6c6b8;font-size:15px;line-height:1.7;">
            We received your message and will get back to you soon.
          </p>
        </div>

        <div style="padding:28px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#f5ede3;">
            Hi ${escapeHtml(name)},
          </p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#d6c6b8;">
            Thanks for contacting Books and Brews. Your message came through successfully, and we’ll review it as soon as possible.
          </p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#d6c6b8;">
            We focus on building smart, custom websites with a smooth process and clear communication from start to finish.
          </p>

          <div style="margin-top:20px;padding:16px 18px;background:rgba(199,144,88,.08);border:1px solid rgba(199,144,88,.24);border-radius:14px;color:#e9d8c8;font-size:14px;line-height:1.7;">
            If your request is project-related, feel free to reply to this email with any extra details, timeline notes, or goals for your site.
          </div>

          <p style="margin:24px 0 0;font-size:15px;line-height:1.8;color:#f5ede3;">
            Books and Brews<br>
            Smart Websites. Smooth Experience.
          </p>
        </div>
      </div>
    </div>
  </div>
  `;
}

function getCustomerQuoteReply({ name, businessName, projectType, budgetRange }) {
  return `
  <div style="margin:0;padding:0;background:#0b0b0c;font-family:Inter,Arial,sans-serif;color:#f5ede3;">
    <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
      <div style="background:linear-gradient(180deg,#161313,#100f0f);border:1px solid #2a211d;border-radius:20px;overflow:hidden;">
        
        <div style="padding:28px 28px 18px;border-bottom:1px solid #2a211d;background:radial-gradient(circle at top right, rgba(199,144,88,.20), transparent 35%), linear-gradient(180deg,#1b1716,#121111);">
          <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#d6c6b8;margin-bottom:10px;">Books and Brews</div>
          <h1 style="margin:0;font-size:30px;line-height:1.15;color:#f5ede3;font-family:Georgia,serif;font-weight:700;">
            Quote request received
          </h1>
          <p style="margin:12px 0 0;color:#d6c6b8;font-size:15px;line-height:1.7;">
            Thanks for sending your project details. We’ll review everything and follow up soon.
          </p>
        </div>

        <div style="padding:28px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#f5ede3;">
            Hi ${escapeHtml(name)},
          </p>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#d6c6b8;">
            We received your quote request${businessName ? ` for <strong>${escapeHtml(businessName)}</strong>` : ""} and will take a look at the details you submitted.
          </p>

          <div style="margin:20px 0;padding:18px;background:#121111;border:1px solid #2a211d;border-radius:14px;">
            <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#c79058;margin-bottom:10px;">Request Summary</div>
            <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#f5ede3;">
              <strong>Project Type:</strong> ${escapeHtml(projectType || "Not specified")}
            </p>
            <p style="margin:0;font-size:15px;line-height:1.8;color:#f5ede3;">
              <strong>Budget Range:</strong> ${escapeHtml(budgetRange || "Not specified")}
            </p>
          </div>

          <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#d6c6b8;">
            If you want to add anything else before we reply, just respond to this email and it will come straight through.
          </p>

          <p style="margin:24px 0 0;font-size:15px;line-height:1.8;color:#f5ede3;">
            Books and Brews<br>
            Smart Websites. Smooth Experience.
          </p>
        </div>
      </div>
    </div>
  </div>
  `;
}

function infoRow(label, value) {
  return `
    <div style="padding:14px 16px;margin-bottom:12px;background:#121111;border:1px solid #2a211d;border-radius:14px;">
      <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#c79058;margin-bottom:6px;">${escapeHtml(label)}</div>
      <div style="font-size:15px;line-height:1.7;color:#f5ede3;">${escapeHtml(value || "Not provided")}</div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}