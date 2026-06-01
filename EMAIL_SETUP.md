## Contact Form Email Setup: Cloudflare to Gmail

This project is set up for the free workflow:

- Cloudflare Email Routing forwards `admin@easytechvancouver.ca` to your Gmail inbox.
- The contact form Worker sends notification emails from `admin@easytechvancouver.ca` to your Gmail inbox.
- Replies to contact form notifications go to the customer because the Worker sets `Reply-To`.

The receiving inbox is:

```text
abhijeet.karmaker@gmail.com
```

### 1. Set up Cloudflare Email Routing in Cloudflare

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

### 2. Confirm the Worker email binding

The repo is already configured in [wrangler.toml](/workspaces/tech-help-website/wrangler.toml):

- `SEND_FROM` is set to `admin@easytechvancouver.ca`
- `SEND_TO` is set to `abhijeet.karmaker@gmail.com`
- `[[send_email]].destination_address` is set to `abhijeet.karmaker@gmail.com`
- Worker routes are set for `easytechvancouver.ca/api/contact` and `www.easytechvancouver.ca/api/contact`

Cloudflare requires the sender address to use a domain that has Email Routing active, so keep `SEND_FROM` on `easytechvancouver.ca`. The Gmail destination must also be verified in Email Routing before the Worker can send to it.

### 3. Set secrets and deploy

Install Wrangler if needed:

```bash
npm install --save-dev wrangler
```

Log in to Cloudflare:

```bash
npx wrangler login
```

Set the reCAPTCHA secret used by the contact form:

```bash
npx wrangler secret put RECAPTCHA_SECRET_KEY
```

Deploy the Worker:

```bash
npx wrangler deploy
```

If you want to test the Worker locally with Cloudflare's remote email binding, run:

```bash
npx wrangler dev --remote
```

### 4. Test the setup

1. Send a normal email to `admin@easytechvancouver.ca`.
2. Confirm it arrives in `abhijeet.karmaker@gmail.com`.
3. Open `https://easytechvancouver.ca/contact.html`.
4. Submit a real test message through the form.
5. Confirm the form notification arrives in Gmail.
6. In Gmail, press `Reply` on the notification. It should reply to the customer's email address because the Worker sets `Reply-To`.

For a command-line Worker test after deploy, replace the sample values and run:

```bash
curl -i https://easytechvancouver.ca/api/contact \
  -H "Content-Type: application/json" \
  --data '{"name":"Test User","email":"test@example.com","phone":"604-555-0100","message":"Testing the contact form.","g-recaptcha-response":"RECAPTCHA_TOKEN_FROM_BROWSER"}'
```

The `curl` test needs a real reCAPTCHA token from the browser. If the token is missing or fake, the Worker should return a reCAPTCHA error, which still proves the Worker route is reachable.

### 5. Fix Cloudflare security blocking `/api/contact`

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

Keep reCAPTCHA enabled in the form and Worker. This lets your own spam check run while preventing Cloudflare from returning an HTML challenge to the form submission.

### 6. How the contact form works

- Visitors submit the form on `contact.html`.
- The Worker sends the notification to your Gmail inbox.
- In Gmail, pressing Reply sends your response to the customer because of the email `Reply-To` header.

### 7. Important free-plan limitation

This is forwarding into Gmail, not a true Gmail-hosted mailbox for your domain.

- Receiving at `admin@easytechvancouver.ca`: yes, free through Cloudflare forwarding.
- Contact form notifications from `admin@easytechvancouver.ca`: yes, through the Cloudflare Worker email binding.
- Replying to customers from Gmail after a form submission: yes, but by default the reply is sent from your Gmail address while replying to the customer's email.
- Sending new Gmail messages as `admin@easytechvancouver.ca`: not included automatically for free.
- Full mailbox at `admin@easytechvancouver.ca` inside Gmail: requires Google Workspace.

### 8. Sending as `admin@easytechvancouver.ca`

To send regular outbound emails from Gmail with the `admin@easytechvancouver.ca` sender, use one of these options:

1. Google Workspace: creates a real Gmail mailbox for `admin@easytechvancouver.ca`.
2. Gmail "Send mail as" plus an SMTP provider: add `admin@easytechvancouver.ca` in Gmail settings and use SMTP credentials from a mail service that supports your domain.

Cloudflare Email Routing alone forwards inbound mail. It does not create a full Gmail mailbox or SMTP login for outbound Gmail sending.
