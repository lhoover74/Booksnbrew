function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const form = await request.formData();

    const email = (form.get("email") || "").toString().trim().toLowerCase();
    const password = (form.get("password") || "").toString().trim();
    const name = (form.get("name") || "").toString().trim();

    if (!email || !password || !name) {
      return json(
        { ok: false, error: "Name, email, and password are required." },
        400
      );
    }

    const loginUrl = "https://booksnbrew.pages.dev/client/login.html";

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Your Client Portal Access</title>
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
                  Your client portal is ready
                </h1>
                <p style="margin:14px 0 0;font-size:15px;line-height:1.8;color:#6f6258;">
                  You can now log in securely to view your project details, status, and updates.
                </p>
              </div>

              <div style="padding:30px;">
                <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#524840;">
                  Hi ${escapeHtml(name)},
                </p>

                <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:#65584f;">
                  Your Books and Brews client portal access has been created.
                </p>

                <div style="margin:22px 0;padding:18px;background:#efe9e3;border:1px solid #d7c8bb;border-radius:18px;">
                  <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#b07b4d;margin-bottom:10px;">
                    Login Details
                  </div>
                  <p style="margin:0 0 10px;font-size:15px;line-height:1.8;color:#4f443d;">
                    <strong>Email:</strong> ${escapeHtml(email)}
                  </p>
                  <p style="margin:0;font-size:15px;line-height:1.8;color:#4f443d;">
                    <strong>Temporary Password:</strong> ${escapeHtml(password)}
                  </p>
                </div>

                <div style="margin-top:24px;text-align:center;">
                  <a href="${loginUrl}"
                    style="display:inline-block;padding:14px 26px;background:#c79058;color:#1a120e;text-decoration:none;border-radius:8px;font-weight:600;">
                    Open Client Portal
                  </a>
                </div>

                <p style="margin:22px 0 0;font-size:14px;line-height:1.8;color:#7a6c62;">
                  For security, keep your login details private. You can use this portal to view project information and updates.
                </p>

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

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Books and Brews <quotes@booksnbrew.govdirect.org>",
        to: [email],
        subject: "Your Books and Brews Client Portal Access",
        html,
        replyTo: "michael@govdirect.org"
      })
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      return json(
        { ok: false, error: resendData },
        500
      );
    }

    return json({ ok: true });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to send invite."
      },
      500
    );
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}