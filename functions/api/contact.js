export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const formData = await request.formData();

    // ── Read form fields ──────────────────────────────────────────
    const formType       = (formData.get("formType")       || "contact").toString();
    const name           = (formData.get("name")           || "").toString().trim();
    const email          = (formData.get("email")          || "").toString().trim();
    const phone          = (formData.get("phone")          || "").toString().trim();
    const businessName   = (formData.get("businessName")   || "").toString().trim();
    const projectType    = (formData.get("projectType")    || "").toString().trim();
    const budgetRange    = (formData.get("budgetRange")    || "").toString().trim();
    const projectDetails = (formData.get("projectDetails") || "").toString().trim();
    const message        = (formData.get("message")        || "").toString().trim();

    // ── Spam traps ────────────────────────────────────────────────
    // Honeypot: visually hidden field. Bots fill it; real users do not.
    const honeypot = (formData.get("website") || "").toString().trim();
    // Cloudflare Turnstile widget token injected automatically by the browser script.
    const turnstileToken = (formData.get("cf-turnstile-response") || "").toString().trim();

    if (!name || !email) {
      return jsonResponse(
        { ok: false, error: "Name and email are required." },
        400
      );
    }

    // ── Turnstile server-side verification ────────────────────────
    // Requires TURNSTILE_SECRET_KEY set in Cloudflare Pages →
    // Settings → Environment Variables (see README).
    // If the binding is absent (e.g. local dev), verification is skipped.
    const clientIP = request.headers.get("CF-Connecting-IP") || "";
    let turnstileValid = true;
    if (env.TURNSTILE_SECRET_KEY) {
      turnstileValid = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, clientIP);
    }

    // ── Lead scoring: High | Normal | Spam ───────────────────────
    const spamScore = scoreSubmission({
      honeypot,
      turnstileValid,
      message,
      projectDetails,
      budgetRange,
      phone
    });

    const isSpam  = spamScore === "Spam";
    const isQuote = formType === "quote";

    // priority mirrors the spam score; for non-spam, business logic determines High/Normal
    const priority = spamScore;

    const submittedAt = new Date().toISOString();
    const displaySubmittedAt = new Date(submittedAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    const sourcePage = getSourcePage(request, formType);

    // ── Persist to D1 ─────────────────────────────────────────────
    // All submissions (including spam) are stored for audit purposes.
    // Spam submissions get status = 'Spam'; others start as 'New'.
    let leadId = null;
    if (env.DB) {
      leadId = await saveLead(env.DB, {
        formType,
        name,
        email,
        phone,
        businessName,
        projectType,
        budgetRange,
        message,
        projectDetails,
        sourcePage,
        priority,
        spamScore,
        submittedAt
      });
    }

    // ── Email configuration ───────────────────────────────────────
    // Set RESEND_FROM_EMAIL and ADMIN_EMAIL in Cloudflare Pages →
    // Settings → Environment Variables (see README).
    const fromEmail  = env.RESEND_FROM_EMAIL || "quotes@booksnbrew.govdirect.org";
    const adminEmail = env.ADMIN_EMAIL       || "michael@govdirect.org";

    // ── Admin notification (always sent, even for spam) ───────────
    const spamPrefix = isSpam ? "🚫 [SPAM] " : "";
    const subject = isQuote
      ? `${spamPrefix}🔥 New Website Quote Request (${budgetRange || "No Budget"}) - ${name}`
      : `${spamPrefix}📩 New Website Inquiry - ${name}`;

    const adminHtml = isQuote
      ? getAdminQuoteEmail({
          leadId,
          name,
          email,
          phone,
          businessName,
          projectType,
          budgetRange,
          projectDetails,
          submittedAt: displaySubmittedAt,
          sourcePage,
          priority,
          spamScore
        })
      : getAdminContactEmail({
          leadId,
          name,
          email,
          phone,
          message,
          submittedAt: displaySubmittedAt,
          sourcePage,
          priority,
          spamScore
        });

    const adminSend = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from:    `Books and Brews <${fromEmail}>`,
        to:      [adminEmail],
        subject,
        html:    adminHtml,
        replyTo: email
      })
    });

    const adminData = await adminSend.json();
    if (!adminSend.ok) {
      return jsonResponse({ ok: false, error: adminData }, 500);
    }

    // ── Auto-reply (skipped for spam) ─────────────────────────────
    // Do not notify the submitter when they have been classified as spam.
    // We still redirect to thank-you.html to avoid revealing the classification.
    if (!isSpam) {
      const autoReplySubject = isQuote
        ? "We received your quote request — Books and Brews"
        : "We received your message — Books and Brews";

      const autoReplyHtml = isQuote
        ? getCustomerQuoteReply({ name, businessName, projectType, budgetRange })
        : getCustomerContactReply({ name });

      const customerSend = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from:    `Books and Brews <${fromEmail}>`,
          to:      [email],
          subject: autoReplySubject,
          html:    autoReplyHtml,
          replyTo: adminEmail
        })
      });

      const customerData = await customerSend.json();
      if (!customerSend.ok) {
        return jsonResponse({ ok: false, error: customerData }, 500);
      }
    }

    // Redirect to thank-you regardless of spam classification.
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

// ── Turnstile server-side verification ───────────────────────────
// Calls the Cloudflare Turnstile /siteverify endpoint.
// Returns true only when Cloudflare confirms the token is genuine.
async function verifyTurnstile(token, secret, ip) {
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  const res  = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body
  });
  const data = await res.json();
  return data.success === true;
}

// ── Lead scoring ──────────────────────────────────────────────────
// Returns: 'Spam' | 'High' | 'Normal'
//
// Resolution order:
//   1. Hard traps  → honeypot filled or Turnstile failed → Spam
//   2. Soft signal accumulation score ≥ 3              → Spam
//   3. High-value budget tier or project-intent signals → High
//   4. Everything remaining                             → Normal
function scoreSubmission({ honeypot, turnstileValid, message, projectDetails, budgetRange, phone }) {
  // Hard traps: automatic spam classification
  if (honeypot)        return "Spam";
  if (!turnstileValid) return "Spam";

  const body = ((message || "") + " " + (projectDetails || "")).toLowerCase();

  let spamPoints = 0;

  // Very short / empty body — likely a bot probe
  if (body.trim().length < 10) spamPoints += 2;

  // Multiple URLs — common in link-spam submissions
  const urlMatches = body.match(/https?:\/\//g) || [];
  if (urlMatches.length >= 2) spamPoints += urlMatches.length;

  // Known spam topic keywords
  const spamKeywords = [
    "casino", "viagra", "loan offer", "payday loan", "crypto ",
    "bitcoin", "nft ", "backlink", "guest post", "seo service",
    "adult content", "make money fast", "earn $"
  ];
  for (const kw of spamKeywords) {
    if (body.includes(kw)) spamPoints += 2;
  }

  if (spamPoints >= 3) return "Spam";

  // High-value: budget-based (quote form)
  if (
    budgetRange &&
    (budgetRange.includes("5,000") || budgetRange.includes("5000") ||
     budgetRange.includes("10,000") || budgetRange.includes("10000") ||
     budgetRange.includes("+"))
  ) {
    return "High";
  }

  // High-value: project-intent keywords + phone provided (contact form)
  const highValueKeywords = [
    "project", "launch", "ecommerce", "e-commerce", "redesign",
    "online store", "deadline", "urgent", "asap", "my business",
    "our business", "website for"
  ];
  if (phone && highValueKeywords.some((kw) => body.includes(kw))) return "High";

  return "Normal";
}

// ── D1 persistence ────────────────────────────────────────────────
// spam_score column was added in migrations/001_add_spam_score.sql.
// status is set to 'Spam' for spam submissions; 'New' for everyone else.
async function saveLead(DB, lead) {
  const status = lead.spamScore === "Spam" ? "Spam" : "New";

  const result = await DB.prepare(`
    INSERT INTO leads (
      form_type,
      name,
      email,
      phone,
      business_name,
      project_type,
      budget_range,
      message,
      project_details,
      source_page,
      status,
      priority,
      spam_score,
      submitted_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      lead.formType,
      lead.name,
      lead.email,
      lead.phone          || null,
      lead.businessName   || null,
      lead.projectType    || null,
      lead.budgetRange    || null,
      lead.message        || null,
      lead.projectDetails || null,
      lead.sourcePage,
      status,
      lead.priority,
      lead.spamScore,
      lead.submittedAt,
      lead.submittedAt
    )
    .run();

  return result.meta?.last_row_id || null;
}

function getSourcePage(request, formType) {
  const referer = request.headers.get("referer");

  if (!referer) {
    return formType === "quote" ? "/quote.html" : "/contact.html";
  }

  try {
    const url = new URL(referer);
    return url.pathname || (formType === "quote" ? "/quote.html" : "/contact.html");
  } catch {
    return formType === "quote" ? "/quote.html" : "/contact.html";
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

function getAdminContactEmail({
  leadId,
  name,
  email,
  phone,
  message,
  submittedAt,
  sourcePage,
  priority,
  spamScore
}) {
  const isSpam = spamScore === "Spam";
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
              ${isSpam ? "⚠️ Spam Submission Detected" : "New Contact Inquiry"}
            </h1>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.8;color:#d6c6b8;">
              ${isSpam
                ? "This submission was flagged as spam and saved for audit. No auto-reply was sent."
                : "A new lead just came in through your website contact form."}
            </p>
          </div>

          ${isSpam ? `
          <div style="margin:20px 28px 0;padding:14px 18px;background:rgba(200,50,50,.15);border:1px solid rgba(200,50,50,.4);border-radius:14px;color:#f5ede3;font-size:14px;line-height:1.8;">
            🚫 <strong>Spam Classification:</strong> This submission failed one or more spam checks (Turnstile, honeypot, or content scoring). No auto-reply was sent to the submitter.
          </div>` : ""}

          <div style="padding:28px;">
            ${leadId ? infoRow("Lead ID", String(leadId)) : ""}
            ${infoRow("Spam Score", spamScore)}
            ${infoRow("Priority", priority)}
            ${infoRow("Name", name)}
            ${infoRow("Email", email)}
            ${infoRow("Phone", phone || "Not provided")}
            ${infoRow("Source Page", sourcePage)}
            ${infoRow("Submitted", submittedAt)}

            <div style="margin-top:20px;padding:18px;background:#121111;border:1px solid #2a211d;border-radius:14px;">
              <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#c79058;margin-bottom:10px;">
                Message
              </div>
              <div style="font-size:15px;line-height:1.85;color:#f5ede3;">
                ${escapeHtml(message || "No message provided.").replace(/\n/g, "<br>")}
              </div>
            </div>

            ${!isSpam ? `
            <div style="margin-top:24px;padding:16px 18px;background:rgba(199,144,88,.08);border:1px solid rgba(199,144,88,.24);border-radius:14px;color:#e9d8c8;font-size:14px;line-height:1.8;">
              Reply directly to this email to respond to <strong>${escapeHtml(name)}</strong>.
            </div>` : ""}
          </div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

function getAdminQuoteEmail({
  leadId,
  name,
  email,
  phone,
  businessName,
  projectType,
  budgetRange,
  projectDetails,
  submittedAt,
  sourcePage,
  priority,
  spamScore
}) {
  const isSpam    = spamScore === "Spam";
  const isHighValue = priority === "High";
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
              ${isSpam ? "⚠️ Spam Submission Detected" : "New Quote Request"}
            </h1>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.8;color:#d6c6b8;">
              ${isSpam
                ? "This submission was flagged as spam and saved for audit. No auto-reply was sent."
                : "A new project inquiry was submitted through your website quote form."}
            </p>
            ${isHighValue && !isSpam
              ? `<div style="margin-top:18px;display:inline-block;padding:12px 16px;background:#c79058;color:#1a120e;border-radius:12px;font-size:14px;font-weight:700;">
              High Value Lead
            </div>`
              : ""}
          </div>

          ${isSpam ? `
          <div style="margin:20px 28px 0;padding:14px 18px;background:rgba(200,50,50,.15);border:1px solid rgba(200,50,50,.4);border-radius:14px;color:#f5ede3;font-size:14px;line-height:1.8;">
            🚫 <strong>Spam Classification:</strong> This submission failed one or more spam checks (Turnstile, honeypot, or content scoring). No auto-reply was sent to the submitter.
          </div>` : ""}

          <div style="padding:28px;">
            ${leadId ? infoRow("Lead ID", String(leadId)) : ""}
            ${infoRow("Spam Score", spamScore)}
            ${infoRow("Priority", priority)}
            ${infoRow("Name", name)}
            ${infoRow("Email", email)}
            ${infoRow("Phone", phone || "Not provided")}
            ${infoRow("Business Name", businessName || "Not provided")}
            ${infoRow("Project Type", projectType || "Not selected")}
            ${infoRow("Budget Range", budgetRange || "Not selected")}
            ${infoRow("Source Page", sourcePage)}
            ${infoRow("Submitted", submittedAt)}

            <div style="margin-top:20px;padding:18px;background:#121111;border:1px solid #2a211d;border-radius:14px;">
              <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#c79058;margin-bottom:10px;">
                Project Details
              </div>
              <div style="font-size:15px;line-height:1.85;color:#f5ede3;">
                ${escapeHtml(projectDetails || "No project details provided.").replace(/\n/g, "<br>")}
              </div>
            </div>

            ${!isSpam ? `
            <div style="margin-top:24px;padding:16px 18px;background:rgba(199,144,88,.08);border:1px solid rgba(199,144,88,.24);border-radius:14px;color:#e9d8c8;font-size:14px;line-height:1.8;">
              Reply directly to this email to respond to <strong>${escapeHtml(name)}</strong>.
            </div>` : ""}
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