## Contact Form Setup: Cloudflare Worker, Turnstile & Gmail

This project uses a free workflow:

- Cloudflare Turnstile protects the contact form from bots/spam (no Google Cloud account or billing required).
- Cloudflare Email Routing forwards `admin@easytechvancouver.ca` to your Gmail inbox.
- The contact form Worker verifies the Turnstile token, then sends a notification email from `admin@easytechvancouver.ca` to your Gmail inbox.
- Replies to contact form notifications go to the customer because the Worker sets `Reply-To`.
- A branded auto-reply email to the customer exists in the Worker code but is currently **disabled** (`AUTO_REPLY_ENABLED = "false"` in [wrangler.toml](/workspaces/tech-help-website/wrangler.toml)). Cloudflare's `send_email` binding can only deliver to one fixed `destination_address`, so it can't send to arbitrary customer addresses. Re-enabling this requires wiring up a separate free email API for the customer-facing message.

The receiving inbox is:

```text
abhijeet.karmaker@gmail.com
```

### 1. Set up Cloudflare Email Routing

In the Cloudflare dashboard for `easytechvancouver.ca`:

1. Go to `Email` -> `Email Routing`.
2. Select `Add records and enable`.
3. Let Cloudflare add the required `MX` and `TXT` DNS records.
4. If Cloudflare warns about existing `MX` records, remove the old mail provider records unless you are intentionally using another mail service.
5. Go to `Routing rules`.
6. Under `Custom addresses`, select `Create address`.
7. Create this address:
   - Custom address: `admin`
   - Destination: `abhijeet.karmaker@gmail.com`
8. Save the rule.
9. Open the Cloudflare verification email in Gmail and click `Verify email address`.
10. Return to Cloudflare and confirm the destination status is `Verified` and the route is `Active`.

After this, mail sent to `admin@easytechvancouver.ca` will arrive in Gmail for free.

### 2. Set up Cloudflare Turnstile

In the Cloudflare dashboard:

1. Go to `Turnstile`.
2. Create a widget for `easytechvancouver.ca` (add `www.easytechvancouver.ca` too).
3. Copy the **Site Key** and **Secret Key**.
4. The Site Key is hardcoded in [contact.html](/workspaces/tech-help-website/contact.html) (`turnstile.render(... sitekey: '0x4AAAAAADiJZamPHvtx8ukB' ...)`). Update it there if you create a new widget.
5. The Secret Key must be set as a Worker secret (see step 4 below).

### 3. Confirm the Worker configuration

The repo is already configured in [wrangler.toml](/workspaces/tech-help-website/wrangler.toml):

- `SEND_FROM` is set to `admin@easytechvancouver.ca`
- `SEND_TO` is set to `abhijeet.karmaker@gmail.com`
- `AUTO_REPLY_ENABLED` is `"false"` (customer auto-reply disabled — see note above)
- `[[send_email]].destination_address` is set to `abhijeet.karmaker@gmail.com`
- Worker routes are set for `easytechvancouver.ca/api/contact` and `www.easytechvancouver.ca/api/contact`

Cloudflare requires the sender address to use a domain that has Email Routing active, so keep `SEND_FROM` on `easytechvancouver.ca`. The Gmail destination must also be verified in Email Routing before the Worker can send to it.

### 4. Set secrets and deploy

Install Wrangler if needed:

```bash
npm install --save-dev wrangler
```

Log in to Cloudflare:

```bash
npx wrangler login
```

Set the Turnstile secret used by the contact form:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Deploy the Worker:

```bash
npx wrangler deploy
```

If you want to test the Worker locally with Cloudflare's remote email binding, run:

```bash
npx wrangler dev --remote
```

### 5. Test the setup

1. Send a normal email to `admin@easytechvancouver.ca`.
2. Confirm it arrives in `abhijeet.karmaker@gmail.com`.
3. Open `https://easytechvancouver.ca/contact.html`.
4. Complete the Turnstile widget and submit a real test message through the form.
5. Confirm the form notification arrives in Gmail.
6. In Gmail, press `Reply` on the notification. It should reply to the customer's email address because the Worker sets `Reply-To`.

For a command-line Worker test after deploy, replace the sample values and run:

```bash
curl -i https://easytechvancouver.ca/api/contact \
  -H "Content-Type: application/json" \
  --data '{"name":"Test User","email":"test@example.com","phone":"604-555-0100","message":"Testing the contact form.","cf-turnstile-response":"TURNSTILE_TOKEN_FROM_BROWSER"}'
```

The `curl` test needs a real Turnstile token from the browser. If the token is missing or fake, the Worker should return a Turnstile verification error, which still proves the Worker route is reachable.

### 6. Fix Cloudflare security blocking `/api/contact`

If the form shows an error and a direct test returns a Cloudflare `403` challenge, Cloudflare security is intercepting the AJAX request before it reaches the Worker.

In the Cloudflare dashboard:

1. Go to `Security` -> `WAF` -> `Custom rules`.
2. Create a rule named `Allow contact form Worker`.
3. Use this expression:

```text
(http.host in {"easytechvancouver.ca" "www.easytechvancouver.ca"} and http.request.uri.path eq "/api/contact")
```

4. Choose action `Skip`.
5. Skip these products if shown:
   - WAF Managed Rules
   - Super Bot Fight Mode / Bot Fight Mode
   - Browser Integrity Check
   - Security Level
6. Save and deploy the rule.

Keep Turnstile enabled in the form and Worker. This lets your own spam check run while preventing Cloudflare from returning an HTML challenge to the form submission.

### 7. How the contact form works

- Visitors submit the form on `contact.html` after completing the Turnstile challenge.
- The Worker verifies the Turnstile token with Cloudflare, then sends the notification to your Gmail inbox.
- In Gmail, pressing Reply sends your response to the customer because of the email `Reply-To` header.

### 8. Important free-plan limitation

This is forwarding into Gmail, not a true Gmail-hosted mailbox for your domain.

- Receiving at `admin@easytechvancouver.ca`: yes, free through Cloudflare forwarding.
- Contact form notifications from `admin@easytechvancouver.ca`: yes, through the Cloudflare Worker email binding.
- Replying to customers from Gmail after a form submission: yes, but by default the reply is sent from your Gmail address while replying to the customer's email.
- Sending new Gmail messages as `admin@easytechvancouver.ca`: not included automatically for free.
- Full mailbox at `admin@easytechvancouver.ca` inside Gmail: requires Google Workspace.

### 9. Sending as `admin@easytechvancouver.ca`

To send regular outbound emails from Gmail with the `admin@easytechvancouver.ca` sender, use one of these options:

1. Google Workspace: creates a real Gmail mailbox for `admin@easytechvancouver.ca`.
2. Gmail "Send mail as" plus an SMTP provider: add `admin@easytechvancouver.ca` in Gmail settings and use SMTP credentials from a mail service that supports your domain.

Cloudflare Email Routing alone forwards inbound mail. It does not create a full Gmail mailbox or SMTP login for outbound Gmail sending.

### 10. Customer auto-reply (pending)

The Worker already contains a branded HTML/text auto-reply (logo, "24-48 hours" message, phone/WhatsApp, social links) that would be sent to the customer's own email address. It's gated behind `AUTO_REPLY_ENABLED` and currently off because Cloudflare's `send_email` binding only allows sending to the single `destination_address` configured in `[[send_email]]` — not to arbitrary customer addresses.

To enable it:

1. Pick a free transactional email API that allows sending to arbitrary recipients (e.g. Brevo, Mailjet, SMTP2GO — Resend and SendGrid have been ruled out).
2. Verify `easytechvancouver.ca` as a sending domain with that provider (DNS records added in Cloudflare).
3. Update the `if (autoReplyEnabled) { ... }` block in [cloudflare/contact-worker.js](/workspaces/tech-help-website/cloudflare/contact-worker.js) to call that provider's HTTP API instead of the Cloudflare email binding.
4. Set the provider's API key as a Worker secret (`npx wrangler secret put <PROVIDER>_API_KEY`).
5. Set `AUTO_REPLY_ENABLED = "true"` in `wrangler.toml` and redeploy.
