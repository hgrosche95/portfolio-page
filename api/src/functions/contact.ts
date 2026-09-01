import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';

/**
 * Contact form endpoint: POST /api/contact
 *
 * Validates the submission, drops obvious bot traffic, and forwards it as an
 * email through Brevo's transactional API. Configuration comes from the Static
 * Web App's application settings — nothing is committed:
 *
 *   BREVO_API_KEY    the transactional API key
 *   CONTACT_TO_EMAIL where submissions are delivered
 *   CONTACT_FROM_EMAIL  a sender address verified in Brevo
 */

const LIMITS = { name: 80, email: 120, message: 4000 } as const;
const MIN_MESSAGE_LENGTH = 10;

/** Deliberately permissive: the goal is catching typos, not policing addresses. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type ContactPayload = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  /** Honeypot — a real browser leaves this hidden field empty. */
  company?: unknown;
};

/**
 * Best-effort rate limiting, in memory. A serverless host may run several
 * instances and recycle them at any time, so this throttles a single noisy
 * client rather than guaranteeing a global limit. A real limit would need
 * shared state (Table Storage, Redis); that is not worth the moving parts for
 * a portfolio contact form, and the honeypot does the heavy lifting anyway.
 */
const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };
const recentSubmissions = new Map<string, number[]>();

function isRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const hits = (recentSubmissions.get(clientKey) ?? []).filter(
    (time) => now - time < RATE_LIMIT.windowMs,
  );

  hits.push(now);
  recentSubmissions.set(clientKey, hits);

  // Keep the map from growing without bound across a long-lived instance.
  if (recentSubmissions.size > 500) {
    for (const [key, times] of recentSubmissions) {
      if (times.every((time) => now - time >= RATE_LIMIT.windowMs)) recentSubmissions.delete(key);
    }
  }

  return hits.length > RATE_LIMIT.max;
}

function clientKeyOf(request: HttpRequest): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',')[0]?.trim() || 'unknown';
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validate(payload: ContactPayload) {
  const name = asTrimmedString(payload.name);
  const email = asTrimmedString(payload.email);
  const message = asTrimmedString(payload.message);
  const errors: Record<string, string> = {};

  if (!name) errors.name = 'Bitte gib deinen Namen an.';
  else if (name.length > LIMITS.name) errors.name = `Höchstens ${LIMITS.name} Zeichen.`;

  if (!email) errors.email = 'Bitte gib deine E-Mail-Adresse an.';
  else if (email.length > LIMITS.email) errors.email = `Höchstens ${LIMITS.email} Zeichen.`;
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Diese E-Mail-Adresse sieht nicht gültig aus.';

  if (!message) errors.message = 'Bitte schreib eine Nachricht.';
  else if (message.length < MIN_MESSAGE_LENGTH)
    errors.message = `Mindestens ${MIN_MESSAGE_LENGTH} Zeichen.`;
  else if (message.length > LIMITS.message) errors.message = `Höchstens ${LIMITS.message} Zeichen.`;

  return { name, email, message, errors };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendViaBrevo(fields: { name: string; email: string; message: string }) {
  const apiKey = process.env.BREVO_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL ?? to;

  if (!apiKey || !to) {
    throw new Error('BREVO_API_KEY oder CONTACT_TO_EMAIL ist nicht konfiguriert.');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: from, name: 'Portfolio-Kontaktformular' },
      to: [{ email: to }],
      // So a reply in the mail client goes straight back to the sender.
      replyTo: { email: fields.email, name: fields.name },
      subject: `Kontaktanfrage von ${fields.name}`,
      htmlContent:
        `<p><strong>Name:</strong> ${escapeHtml(fields.name)}<br>` +
        `<strong>E-Mail:</strong> ${escapeHtml(fields.email)}</p>` +
        `<p>${escapeHtml(fields.message).replace(/\n/g, '<br>')}</p>`,
      textContent: `Name: ${fields.name}\nE-Mail: ${fields.email}\n\n${fields.message}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Brevo antwortete mit ${response.status}: ${await response.text()}`);
  }
}

function json(status: number, body: unknown): HttpResponseInit {
  return { status, jsonBody: body };
}

export async function contact(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  // Bots fill every field they find. Answer with success so they do not learn
  // that the submission was discarded.
  if (asTrimmedString(payload.company)) {
    context.log('Honeypot ausgelöst — Anfrage verworfen.');
    return json(200, { ok: true });
  }

  if (isRateLimited(clientKeyOf(request))) {
    return json(429, { error: 'Zu viele Anfragen. Bitte versuch es später noch einmal.' });
  }

  const { name, email, message, errors } = validate(payload);
  if (Object.keys(errors).length > 0) {
    return json(400, { errors });
  }

  try {
    await sendViaBrevo({ name, email, message });
  } catch (error) {
    // The reason stays in the logs; the caller gets no internal detail.
    context.error('Versand fehlgeschlagen:', error);
    return json(502, {
      error: 'Die Nachricht konnte nicht zugestellt werden. Schreib mir gern direkt per E-Mail.',
    });
  }

  context.log(`Kontaktanfrage von ${email} zugestellt.`);
  return json(200, { ok: true });
}

app.http('contact', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'contact',
  handler: contact,
});
