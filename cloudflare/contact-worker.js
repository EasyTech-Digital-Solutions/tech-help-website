import { EmailMessage } from 'cloudflare:email';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const OPTIONS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
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

  if (!env?.EMAIL || typeof env.EMAIL.send !== 'function') {
    return jsonResponse({ error: 'Cloudflare email binding not configured' }, 500);
  }

  if (!env?.RECAPTCHA_SECRET_KEY) {
    return jsonResponse({ error: 'reCAPTCHA secret not configured' }, 500);
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.email || !body.message) {
    return jsonResponse({ error: 'Email and message are required' }, 400);
  }

  if (body.website && String(body.website).trim() !== '') {
    return jsonResponse({ error: 'Spam detected' }, 400);
  }

  const recaptchaToken = body['g-recaptcha-response'];
  if (!recaptchaToken) {
    return jsonResponse({ error: 'reCAPTCHA required' }, 400);
  }

  const recaptchaVerify = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(env.RECAPTCHA_SECRET_KEY)}&response=${encodeURIComponent(recaptchaToken)}`,
  });
  const recaptchaResult = await recaptchaVerify.json();
  if (!recaptchaResult.success) {
    return jsonResponse({ error: 'reCAPTCHA failed' }, 400);
  }

  const name = toDisplayValue(body.name, 'Anonymous');
  const email = toDisplayValue(body.email);
  const phone = toDisplayValue(body.phone, 'Not provided');
  const message = toDisplayValue(body.message);

  try {
    await sendEmail(env.EMAIL, {
      from: sendFrom,
      fromName: 'EasyTech Website',
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
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        '',
        'Message:',
        message,
      ].join('\n'),
    });

    if (autoReplyEnabled) {
      await sendEmail(env.EMAIL, {
        from: sendFrom,
        fromName: 'EasyTech Vancouver',
        to: email,
        subject: 'Thanks for contacting EasyTech - request received',
        html: `
          <p>Hi ${escapeHtml(name)},</p>
          <p>Thanks for your message. We received your request and will reply soon.</p>
          <p>Your message:</p>
          <blockquote>${toHtml(message)}</blockquote>
          <p>If it is urgent, please WhatsApp <a href="https://wa.me/18194342389">819-434-2389</a>.</p>
          <p>Best regards,<br>EasyTech Vancouver</p>
        `,
        text: [
          `Hi ${name},`,
          '',
          'Thanks for your message. We received your request and will reply soon.',
          '',
          'Your message:',
          message,
          '',
          'If it is urgent, please WhatsApp 819-434-2389.',
          '',
          'Best regards,',
          'EasyTech Vancouver',
        ].join('\n'),
      });
    }

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error('Email send failed', error);
    return jsonResponse(
      { error: 'Send failed', details: error?.message || 'Unknown email error' },
      500,
    );
  }
}

async function sendEmail(binding, email) {
  const raw = buildMimeMessage(email);
  const message = new EmailMessage(email.from, email.to, raw);
  return binding.send(message);
}

function buildMimeMessage(email) {
  const boundary = `easytech-${crypto.randomUUID()}`;
  const headers = [
    `From: ${formatAddress(email.from, email.fromName)}`,
    `To: ${formatAddress(email.to)}`,
    email.replyTo ? `Reply-To: ${formatAddress(email.replyTo, email.replyToName)}` : null,
    `Subject: ${encodeHeader(email.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);

  return [
    ...headers,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    email.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    email.html,
    '',
    `--${boundary}--`,
  ].join('\r\n');
}

function formatAddress(address, name = '') {
  const cleanAddress = sanitizeHeader(address);
  const cleanName = sanitizeHeader(name);

  if (!cleanName) {
    return `<${cleanAddress}>`;
  }

  return `"${cleanName.replace(/"/g, '\\"')}" <${cleanAddress}>`;
}

function encodeHeader(value) {
  const cleanValue = sanitizeHeader(value);
  if (/^[\x00-\x7F]*$/.test(cleanValue)) {
    return cleanValue;
  }

  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(cleanValue)))}?=`;
}

function sanitizeHeader(value) {
  return String(value || '').replace(/[\r\n]/g, ' ').trim();
}

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
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
