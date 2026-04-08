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
    const isHighValue =
      budgetRange &&
      (budgetRange.includes("$5,000") || budgetRange.includes("5000"));

    const submittedAt = new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    });

    const subject = isQuote
      ? `🔥 New Website Quote Request (${budgetRange || "No Budget"}) - ${name}`
      : `📩 New Website Inquiry - ${name}`;

    const autoReplySubject = isQuote
      ? "We received your quote request — Books and Brews"
      : "We received your message — Books and Brews";

    const adminHtml = isQuote
      ? getAdminQuoteEmail({
          name,
          email,
          phone,
          businessName,
          projectType,
          budgetRange,
          projectDetails,
          submittedAt,
          isHighValue
        })
      : getAdminContactEmail({
          name,
          email,
          phone,
          message,
          submittedAt
        });

    const autoReplyHtml = isQuote
      ? getCustomerQuoteReply({
          name,
          businessName,
          projectType,
          budgetRange
        })
      : getCustomerContactReply({ name });

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
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Contact Inquiry</title>
  </head>
  <body style="margin:0;padding:0;background:#0b0b0c;font-family:Inter,Arial,sans-serif;color:#f5ede3;">
    <div style="margin:0;padding:32px 16px;background:#0b0b0c;">
      <div style="max-width:700px;margin:0 auto;">
        <div style="background:linear-gradient(180deg,#161313,#100f0f);border:1px solid #2a211d;border-radius:22px;overflow:hidden;">
          
          <div style="padding:30px 30px 22px;background:
            radial-gradient(circle at top right, rgba(199,144,88,.20), transparent 35%),
            linear-gradient(180deg,#1b1716,#121111);
            border-bottom:1px solid #2a211d;">
            <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#d6c6b8;margin-bottom:10px;">
              Books and Brews
            </div>
            <h1 style="margin:0;font-size:32px;line-height:1.1;color:#f5ede3;font-family:Georgia,serif;font-weight:700;">
              New Contact Inquiry
            </h1>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.8;color:#d6c6b8;">
              A new lead just came in through your website contact form.
            </p>
          </div>

          <div style="padding:28px;">
            ${infoRow("Name", name)}
            ${infoRow("Email", email)}
            ${infoRow("Phone", phone || "Not provided")}
            ${infoRow("Submitted", submittedAt)}

            <div style="margin-top:20px;padding:18px;background:#121111;border:1px solid #2a211d;border-radius:14px;">
              <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#c79058;margin-bottom:10px;">
                Message
              </div>
              <div style="font-size:15px;line-height:1.85;color:#f5ede3;">
                ${escapeHtml(message || "No message provided.").replace(/\n/g, "<br>")}
              </div>
            </div>

            <div style="margin-top:24px;padding:16px 18px;background:rgba(199,144,88,.08);border:1px solid rgba(199,144,88,.24);border-radius:14px;color:#e9d8c8;font-size:14px;line-height:1.8;">
              Reply directly to this email to respond to <strong>${escapeHtml(name)}</strong>.
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
  </html>
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
  submittedAt,
  isHighValue
}) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Quote Request</title>
  </head>
  <body style="margin:0;padding:0;background:#0b0b0c;font-family:Inter,Arial,sans-serif;color:#f5ede3;">
    <div style="margin:0;padding:32px 16px;background:#0b0b0c;">
      <div style="max-width:700px;margin:0 auto;">
        <div style="background:linear-gradient(180deg,#161313,#100f0f);border:1px solid #2a211d;border-radius:22px;overflow:hidden;">
          
          <div style="padding:30px 30px 22px;background:
            radial-gradient(circle at top right, rgba(199,144,88,.20), transparent 35%),
            linear-gradient(180deg,#1b1716,#121111);
            border-bottom:1px solid #2a211d;">
            <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#d6c6b8;margin-bottom:10px;">
              Books and Brews
            </div>
            <h1 style="margin:0;font-size:32px;line-height:1.1;color:#f5ede3;font-family:Georgia,serif;font-weight:700;">
              New Quote Request
            </h1>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.8;color:#d6c6b8;">
              A new project inquiry was submitted through your website quote form.
            </p>
            ${
              isHighValue
                ? `
            <div style="margin-top:18px;display:inline-block;padding:12px 16px;background:#c79058;color:#1a120e;border-radius:12px;font-size:14px;font-weight:700;">
              High Value Lead
            </div>
            `
                : ""
            }
          </div>

          <div style="padding:28px;">
            ${infoRow("Name", name)}
            ${infoRow("Email", email)}
            ${infoRow("Phone", phone || "Not provided")}
            ${infoRow("Business Name", businessName || "Not provided")}
            ${infoRow("Project Type", projectType || "Not selected")}
            ${infoRow("Budget Range", budgetRange || "Not selected")}
            ${infoRow("Submitted", submittedAt)}

            <div style="margin-top:20px;padding:18px;background:#121111;border:1px solid #2a211d;border-radius:14px;">
              <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#c79058;margin-bottom:10px;">
                Project Details
              </div>
              <div style="font-size:15px;line-height:1.85;color:#f5ede3;">
                ${escapeHtml(projectDetails || "No project details provided.").replace(/\n/g, "<br>")}
              </div>
            </div>

            <div style="margin-top:24px;padding:16px 18px;background:rgba(199,144,88,.08);border:1px solid rgba(199,144,88,.24);border-radius:14px;color:#e9d8c8;font-size:14px;line-height:1.8;">
              Reply directly to this email to respond to <strong>${escapeHtml(name)}</strong>.
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

function getCustomerContactReply({ name }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>We received your message</title>
  </head>
  <body style="margin:0;padding:0;background:#0b0b0c;font-family:Inter,Arial,sans-serif;color:#f5ede3;">
    <div style="margin:0;padding:32px 16px;background:#0b0b0c;">
      <div style="max-width:700px;margin:0 auto;">
        <div style="background:#f4f0eb;border:1px solid #ddd3ca;border-radius:24px;overflow:hidden;">
          
          <div style="padding:30px 30px 24px;background:
            radial-gradient(circle at top right, rgba(199,144,88,.12), transparent 28%),
            linear-gradient(180deg,#f7f4ef,#f1ece6);
            border-bottom:1px solid #ddd3ca;">
            <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#7b6a5f;margin-bottom:12px;">
              Books and Brews
            </div>
            <h1 style="margin:0;font-size:34px;line-height:1.06;color:#3b302b;font-family:Georgia,serif;font-weight:700;">
              Thanks for reaching out
            </h1>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.8;color:#6f6258;">
              We received your message and will get back to you soon.
            </p>
          </div>

          <div style="padding:30px;">
            <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#524840;">
              Hi ${escapeHtml(name)},
            </p>

            <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#65584f;">
              Thanks for contacting Books and Brews. Your message came through successfully, and we’ll review it as soon as possible.
            </p>

            <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#65584f;">
              We focus on building smart, custom websites with a smooth process and clear communication from start to finish.
            </p>

            <p style="margin:18px 0 0;font-size:14px;line-height:1.8;color:#7a6c62;">
              We specialize in clean, modern websites built to help businesses stand out, convert visitors, and grow online.
            </p>

            <div style="margin-top:22px;padding:18px;background:#efe9e3;border:1px solid #d7c8bb;border-radius:18px;color:#6a5c52;font-size:14px;line-height:1.9;">
              If your request is project-related, feel free to reply to this email with any extra details, timeline notes, or goals for your site.
            </div>

            <div style="margin-top:24px;text-align:center;">
              <a href="https://booksnbrew.pages.dev/quote.html"
                 style="display:inline-block;padding:14px 26px;background:#c79058;color:#1a120e;text-decoration:none;border-radius:8px;font-weight:600;">
                 View Services / Continue Your Project
              </a>
            </div>

            <div style="margin-top:30px;">
              <p style="margin:0;font-size:15px;color:#3d322d;">
                Books and Brews
              </p>
              <p style="margin:4px 0 0;font-size:13px;color:#7a6c62;">
                Smart Websites. Smooth Experience.
              </p>
              <p style="margin:10px 0 0;font-size:13px;color:#9a8b7f;">
                https://booksnbrew.pages.dev
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

function getCustomerQuoteReply({ name, businessName, projectType, budgetRange }) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>We received your quote request</title>
  </head>
  <body style="margin:0;padding:0;background:#0b0b0c;font-family:Inter,Arial,sans-serif;color:#f5ede3;">
    <div style="margin:0;padding:32px 16px;background:#0b0b0c;">
      <div style="max-width:700px;margin:0 auto;">
        <div style="background:#f4f0eb;border:1px solid #ddd3ca;border-radius:24px;overflow:hidden;">
          
          <div style="padding:30px 30px 24px;background:
            radial-gradient(circle at top right, rgba(199,144,88,.12), transparent 28%),
            linear-gradient(180deg,#f7f4ef,#f1ece6);
            border-bottom:1px solid #ddd3ca;">
            <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#7b6a5f;margin-bottom:12px;">
              Books and Brews
            </div>
            <h1 style="margin:0;font-size:34px;line-height:1.06;color:#3b302b;font-family:Georgia,serif;font-weight:700;">
              Quote request received
            </h1>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.8;color:#6f6258;">
              Thanks for sending your project details. We’ll review everything and follow up soon.
            </p>
          </div>

          <div style="padding:30px;">
            <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#524840;">
              Hi ${escapeHtml(name)},
            </p>

            <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#65584f;">
              We received your quote request${businessName ? ` for <strong>${escapeHtml(businessName)}</strong>` : ""} and will take a close look at the details you submitted.
            </p>

            <p style="margin:18px 0 0;font-size:14px;line-height:1.8;color:#7a6c62;">
              We specialize in clean, modern websites built to help businesses stand out, convert visitors, and grow online.
            </p>

            <div style="margin:22px 0;padding:18px;background:#efe9e3;border:1px solid #d7c8bb;border-radius:18px;">
              <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#b07b4d;margin-bottom:10px;">
                Request Summary
              </div>
              <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;">
                <strong>Project Type:</strong> ${escapeHtml(projectType || "Not specified")}
              </p>
              <p style="margin:0;font-size:15px;line-height:1.8;color:#4f443d;">
                <strong>Budget Range:</strong> ${escapeHtml(budgetRange || "Not specified")}
              </p>
            </div>

            <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#65584f;">
              If you want to add anything before we reply, just respond to this email and it will come straight through.
            </p>

            <div style="margin-top:24px;text-align:center;">
              <a href="https://booksnbrew.pages.dev/quote.html"
                 style="display:inline-block;padding:14px 26px;background:#c79058;color:#1a120e;text-decoration:none;border-radius:8px;font-weight:600;">
                 View Services / Continue Your Project
              </a>
            </div>

            <div style="margin-top:30px;">
              <p style="margin:0;font-size:15px;color:#3d322d;">
                Books and Brews
              </p>
              <p style="margin:4px 0 0;font-size:13px;color:#7a6c62;">
                Smart Websites. Smooth Experience.
              </p>
              <p style="margin:10px 0 0;font-size:13px;color:#9a8b7f;">
                https://booksnbrew.pages.dev
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

function infoRow(label, value) {
  return `
    <div style="padding:14px 16px;margin-bottom:12px;background:#121111;border:1px solid #2a211d;border-radius:14px;">
      <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#c79058;margin-bottom:6px;">
        ${escapeHtml(label)}
      </div>
      <div style="font-size:15px;line-height:1.7;color:#f5ede3;">
        ${escapeHtml(value || "Not provided")}
      </div>
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