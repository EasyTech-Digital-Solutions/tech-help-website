const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': 'https://easytechvancouver.ca',
};

const MAX_LENGTHS = { name: 100, email: 254, phone: 30, message: 5000 };
const TURNSTILE_HOSTNAMES = ['easytechvancouver.ca', 'www.easytechvancouver.ca'];
const TURNSTILE_ACTION = 'contact';

const OPTIONS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://easytechvancouver.ca',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};

async function handleRequest(request, env) {
  const sendFrom = env?.SEND_FROM || 'admin@easytechvancouver.ca';
  const sendTo = env?.SEND_TO || 'admin@easytechvancouver.ca';
  const autoReplyEnabled = env?.AUTO_REPLY_ENABLED === 'true';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: OPTIONS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  if (!env?.GRAPH_TENANT_ID || !env?.GRAPH_CLIENT_ID || !env?.GRAPH_CLIENT_SECRET) {
    return jsonResponse({ error: 'Service temporarily unavailable' }, 500);
  }

  if (!env?.TURNSTILE_SECRET_KEY) {
    return jsonResponse({ error: 'Service temporarily unavailable' }, 500);
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.email || !body.message) {
    return jsonResponse({ error: 'Email and message are required' }, 400);
  }

  if (body.website && String(body.website).trim() !== '') {
    return jsonResponse({ error: 'Spam detected' }, 400);
  }

  const inputError = validateInput(body);
  if (inputError) {
    return jsonResponse({ error: inputError }, 400);
  }

  const turnstileToken = body['cf-turnstile-response'];
  if (!turnstileToken) {
    return jsonResponse({ error: 'Turnstile verification required' }, 400);
  }

  const turnstileVerify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(env.TURNSTILE_SECRET_KEY)}&response=${encodeURIComponent(turnstileToken)}`,
  });
  const turnstileResult = await turnstileVerify.json();
  if (
    !turnstileResult.success ||
    !TURNSTILE_HOSTNAMES.includes(turnstileResult.hostname) ||
    turnstileResult.action !== TURNSTILE_ACTION
  ) {
    return jsonResponse({ error: 'Turnstile verification failed' }, 400);
  }

  const name = toDisplayValue(body.name, 'Anonymous');
  const email = toDisplayValue(body.email);
  const phone = toDisplayValue(body.phone, 'Not provided');
  const message = toDisplayValue(body.message);

  try {
    const graphToken = await getGraphToken(env);

    await sendGraphEmail(env, graphToken, {
      from: sendFrom,
      to: sendTo,
      replyTo: email,
      replyToName: name,
      subject: `New EasyTech inquiry from ${name}`,
      html: `
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Message:</strong></p>
        <p>${toHtml(message)}</p>
      `,
    });

    if (autoReplyEnabled) {
      // The lead has already been delivered, so a failed auto-reply must not tell the visitor their request failed.
      await sendGraphEmail(env, graphToken, {
        from: sendFrom,
        to: email,
        subject: "We've received your request - EasyTech Digital Solutions",
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #333333; line-height: 1.5;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td bgcolor="#0f8069" style="background-color: #0f8069; padding: 22px 24px; text-align: center; color: #ffffff;">
                  <div style="font-size: 20px; font-weight: bold; color: #ffffff;">EasyTech Digital Solutions</div>
                  <div style="font-size: 14px; color: #ffffff;">We've received your request</div>
                </td>
              </tr>
            </table>
            <div style="border: 1px solid #dde5ef; border-top: none; padding: 24px;">
              <p>Hi ${escapeHtml(greetingName(toDisplayValue(body.name)))},</p>
              <p>Thanks for contacting <strong>EasyTech Digital Solutions</strong>. We've received your request and will reply as soon as possible, often the same day.</p>
              <p>If your issue is urgent, call or message us:</p>
              <p>
                Phone: <a href="tel:+17789007135" style="color: #0f8069;">778-900-7135</a><br>
                WhatsApp: <a href="https://wa.me/18194342389" style="color: #0f8069;">wa.me/18194342389</a>
              </p>
              <p>Best regards,<br><strong>The EasyTech Digital Solutions Team</strong></p>
            </div>
            <p style="text-align: center; color: #5d6f89; font-size: 13px; margin: 16px 0 0;">
              EasyTech Digital Solutions &mdash; Local IT support for Metro Vancouver<br>
              <a href="https://easytechvancouver.ca" style="color: #5d6f89;">easytechvancouver.ca</a>
            </p>
          </div>
        `,
      }).catch((error) => console.error('Auto-reply failed', error));
    }

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error('Email send failed', error);
    return jsonResponse(
      { error: 'Send failed' },
      500,
    );
  }
}

async function getGraphToken(env) {
  const response = await fetch(`https://login.microsoftonline.com/${env.GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GRAPH_CLIENT_ID,
      client_secret: env.GRAPH_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Graph token request failed: ${data.error_description || data.error || response.status}`);
  }

  return data.access_token;
}

async function sendGraphEmail(env, token, { from, to, replyTo, replyToName, subject, html }) {
  const message = {
    subject,
    body: { contentType: 'HTML', content: html },
    toRecipients: [{ emailAddress: { address: to } }],
  };

  if (replyTo) {
    message.replyTo = [{ emailAddress: { address: replyTo, name: replyToName || undefined } }];
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: false }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Graph sendMail failed: ${response.status} ${errorText}`);
  }
}

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function validateInput(body) {
  for (const [field, limit] of Object.entries(MAX_LENGTHS)) {
    const value = body[field];
    if (value != null && typeof value !== 'string') {
      return 'Please check the form and try again.';
    }
    if (value && value.length > limit) {
      return `Please shorten your ${field} to ${limit} characters or fewer.`;
    }
  }

  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(body.email.trim())) {
    return 'Please enter a valid email address.';
  }

  return null;
}

// The auto-reply can go to any address typed into the form, so it only repeats a plain first name, never free text or links.
function greetingName(name) {
  const firstWord = name.trim().split(/\s+/)[0] || '';
  return /^[\p{L}][\p{L}\p{M}'’-]{0,29}$/u.test(firstWord) ? firstWord : 'there';
}

function toDisplayValue(value, fallback = '') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function toHtml(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
