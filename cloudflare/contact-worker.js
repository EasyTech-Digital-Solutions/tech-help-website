export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};

async function handleRequest(request, env) {
  const SENDGRID_API_KEY = env?.SENDGRID_API_KEY;
  const SEND_FROM = env?.SEND_FROM || 'info@easytechvancouver.ca';
  const SEND_TO = env?.SEND_TO || 'admin@easytechvancouver.ca';
  
  if (!SENDGRID_API_KEY) {
    return new Response(JSON.stringify({ error: 'SendGrid API key not configured' }), { 
      status: 500, 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      } 
    });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.email || !body.message) {
    return new Response(JSON.stringify({ error: 'Email and message are required' }), { 
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Honeypot check
  if (body.website && body.website.trim() !== "") {
    return new Response(JSON.stringify({ error: 'Spam detected' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // reCAPTCHA verification
  const recaptchaToken = body["g-recaptcha-response"];
  if (!recaptchaToken) {
    return new Response(JSON.stringify({ error: 'reCAPTCHA required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
  const recaptchaSecret = env.RECAPTCHA_SECRET_KEY;
  const recaptchaVerify = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(recaptchaSecret)}&response=${encodeURIComponent(recaptchaToken)}`
  });
  const recaptchaResult = await recaptchaVerify.json();
  if (!recaptchaResult.success) {
    return new Response(JSON.stringify({ error: 'reCAPTCHA failed' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const { name = 'Anonymous', email, phone = '', message } = body;

  const ownerMessage = {
    personalizations: [{ to: [{ email: SEND_TO }] }],
    from: { email: SEND_FROM },
    reply_to: { email },
    subject: `New EasyTech Inquiry from ${name}`,
    content: [{
      type: 'text/html',
      value: `
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
      `,
    }],
  };

  const autoReply = {
    personalizations: [{ to: [{ email }] }],
    from: { email: SEND_FROM },
    subject: 'Thanks for contacting EasyTech — request received',
    content: [{
      type: 'text/html',
      value: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>Thanks for your message. We received your request and will reply within 1 business hour.</p>
        <p>Your message:</p>
        <blockquote>${escapeHtml(message).replace(/\n/g, '<br>')}</blockquote>
        <p>If it’s urgent, please WhatsApp <a href="https://wa.me/18194342389">819-434-2389</a>.</p>
        <p>Best regards,<br>EasyTech Vancouver</p>
      `,
    }],
  };

  try {
    await sendSendGrid(ownerMessage, SENDGRID_API_KEY);
    await sendSendGrid(autoReply, SENDGRID_API_KEY);
    return new Response(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      } 
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Send failed', details: err.message }), { 
      status: 500, 
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      } 
    });
  }
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendSendGrid(payload, apiKey) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SendGrid error: ${res.status} ${errText}`);
  }
}
