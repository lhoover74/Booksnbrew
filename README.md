# Books and Brews Website Package

This package includes:
- Full multi-page static website
- Home, About, Services, Portfolio, Request a Quote, and Contact pages
- Premium dark coffee-toned styling based on the provided visual inspiration
- Mobile navigation
- Reusable CSS system
- Generated design mockup image in `/assets/brand-mockup.png`
- Reference image in `/assets/hero-reference.jpeg`

## Deployment
Upload the folder to GitHub, then connect the repo to Cloudflare Pages or any static host.

## Main files
- `index.html`
- `about.html`
- `services.html`
- `portfolio.html`
- `quote.html`
- `contact.html`
- `styles.css`
- `script.js`

## Notes
The current build is intentionally very close to the provided visual direction: dark cinematic hero, centered lockup, warm coffee accents, serif headline styling, and premium glass-panel navigation.

---

## Cloudflare Setup

### Required: D1 Database binding

1. In the Cloudflare dashboard go to **Workers & Pages → your Pages project → Settings → Functions**.
2. Under **D1 database bindings**, add a binding with the variable name `DB` pointing to your D1 database.

### Required: Run the migration

After deploying for the first time (or to add the `spam_score` column to an existing database), run:

```sh
wrangler d1 execute <YOUR_DB_NAME> --file=migrations/001_add_spam_score.sql
```

Or paste the contents of `migrations/001_add_spam_score.sql` into the **D1 Console** in the Cloudflare dashboard.

---

### Required: Environment variables

Set these in **Workers & Pages → your Pages project → Settings → Environment Variables**.  
Add them for both **Production** and **Preview** environments.

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | Your Resend API key — found at resend.com/api-keys |
| `RESEND_FROM_EMAIL` | The verified sender address, e.g. `quotes@yourdomain.com` |
| `ADMIN_EMAIL` | Where admin notifications are delivered, e.g. `you@yourdomain.com` |
| `TURNSTILE_SECRET_KEY` | The **secret** key for your Turnstile widget — never expose this publicly |

> **Note:** `TURNSTILE_SECRET_KEY` is used server-side only inside `functions/api/contact.js`.  
> It must never be committed to the repository or exposed client-side.

---

### Required: Cloudflare Turnstile widget

The contact form uses Cloudflare Turnstile as a CAPTCHA alternative.

1. Go to **Cloudflare dashboard → Turnstile → Add widget**.
2. Set the hostname to your Pages domain (e.g. `booksnbrew.pages.dev`).
3. Copy the **Site Key** (public) and **Secret Key** (private).
4. In `contact.html`, replace `YOUR_TURNSTILE_SITE_KEY` with the Site Key:
   ```html
   <div class="cf-turnstile" data-sitekey="YOUR_TURNSTILE_SITE_KEY" data-theme="dark"></div>
   ```
5. Add the **Secret Key** as the `TURNSTILE_SECRET_KEY` environment variable (see above).

> **Important:** `TURNSTILE_SITE_KEY` is a public value embedded in the HTML.  
> `TURNSTILE_SECRET_KEY` is confidential and must only be set as a server-side environment variable.

---

### Spam filtering & lead qualification

Every contact and quote submission is scored and stored in D1:

| Score | Meaning |
|---|---|
| **High** | High-value lead (large budget range or clear project intent + phone) |
| **Normal** | Standard legitimate inquiry |
| **Spam** | Failed Turnstile, honeypot filled, or content scored ≥ 3 spam points |

- Spam submissions are saved to D1 with `status = 'Spam'` for audit purposes.
- Admin notification is always sent, with a `[SPAM]` prefix in the subject line.
- Auto-reply is **not** sent to spam submitters.
- The submitter is always redirected to `/thank-you.html` (spam classification is not revealed).

