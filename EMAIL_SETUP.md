## Contact Form Setup: Cloudflare Worker, Turnstile & Microsoft Graph

How the contact form works:

- The form on [contact.html](contact.html) posts JSON to `/api/contact`.
- [cloudflare/contact-worker.js](cloudflare/contact-worker.js) handles that route. It checks the honeypot field, then verifies the Cloudflare Turnstile token.
- The Worker sends a notification to `SEND_TO` (`admin@easytechvancouver.ca`) through the Microsoft Graph `sendMail` API. `Reply-To` is set to the customer, so replying goes to them.
- If `AUTO_REPLY_ENABLED` is `"true"` (it is, in [wrangler.toml](wrangler.toml)), the Worker also sends the customer a branded confirmation.
- Non-secret config lives in [wrangler.toml](wrangler.toml): `SEND_FROM`, `SEND_TO`, `AUTO_REPLY_ENABLED` and the two routes (`easytechvancouver.ca/api/contact` and `www.easytechvancouver.ca/api/contact`).

### 1. Microsoft Graph (mail sending)

In Microsoft Entra (Azure AD), register an app and grant it the **Mail.Send** *application* permission with admin consent. The mailbox in `SEND_FROM` must exist in the tenant. Consider restricting the app to that mailbox with an Exchange application access policy.

### 2. Turnstile

1. In the Cloudflare dashboard, go to `Turnstile` and create a widget for `easytechvancouver.ca` (add `www.` too).
2. The **Site Key** is hardcoded in `contact.html` (`turnstile.render(... sitekey: ...)`). Update it there if you create a new widget.
3. The **Secret Key** is a Worker secret (see below).

### 3. Secrets and deploy

```bash
npx wrangler login
npx wrangler secret put GRAPH_TENANT_ID
npx wrangler secret put GRAPH_CLIENT_ID
npx wrangler secret put GRAPH_CLIENT_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler deploy
```

If any of these secrets is missing, the Worker returns a generic "Service temporarily unavailable" (HTTP 500) and nothing is sent. Details are not exposed to the browser.

### 4. Test

1. Open `https://easytechvancouver.ca/contact`, complete Turnstile, and submit a real message.
2. Confirm the notification arrives at `SEND_TO`, and that replying goes to the address you submitted.
3. Confirm the auto-reply arrives at the address you submitted, with the logo showing.

A command-line test needs a real Turnstile token from the browser. With a missing or fake token the Worker returns a Turnstile error, which still proves the route is reachable:

```bash
curl -i https://easytechvancouver.ca/api/contact \
  -H "Content-Type: application/json" \
  --data '{"name":"Test User","email":"test@example.com","message":"Testing.","cf-turnstile-response":"TOKEN"}'
```

### 5. If Cloudflare security blocks `/api/contact`

If the form errors and a direct test returns a Cloudflare `403` challenge page, add a WAF custom rule (`Security` -> `WAF` -> `Custom rules`):

```text
(http.host in {"easytechvancouver.ca" "www.easytechvancouver.ca"} and http.request.uri.path eq "/api/contact")
```

Action `Skip` for WAF Managed Rules, Bot Fight Mode, Browser Integrity Check and Security Level. Keep Turnstile enabled in the form and the Worker.

### 6. CORS

The Worker only allows the origin `https://easytechvancouver.ca`. The form is same-origin, and `www` redirects to the apex domain. If the form is ever hosted on another origin, update `JSON_HEADERS` and `OPTIONS_HEADERS` in the Worker.
