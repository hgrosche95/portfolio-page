import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';
import { contact } from './contact';

const validPayload = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'Hallo, das ist eine ausreichend lange Testnachricht.',
};

function makeRequest(body: unknown, ip: string): HttpRequest {
  return {
    json: async () => body,
    headers: { get: (name: string) => (name === 'x-forwarded-for' ? ip : null) },
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), error: vi.fn() } as unknown as InvocationContext;
}

// Every test uses its own x-forwarded-for so the module-level rate limiter
// (keyed by client IP) never carries state between unrelated tests.
let nextIp = 1;
function freshIp(): string {
  nextIp += 1;
  return `203.0.113.${nextIp}`;
}

describe('contact', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    process.env.BREVO_API_KEY = 'test-key';
    process.env.CONTACT_TO_EMAIL = 'to@example.com';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BREVO_API_KEY;
    delete process.env.CONTACT_TO_EMAIL;
  });

  it('rejects a body that is not valid JSON', async () => {
    const request = {
      json: async () => {
        throw new Error('not json');
      },
      headers: { get: () => null },
    } as unknown as HttpRequest;

    const res = await contact(request, makeContext());
    expect(res.status).toBe(400);
  });

  it('silently drops honeypot-triggered submissions without sending mail', async () => {
    const res = await contact(
      makeRequest({ ...validPayload, hp_field: 'i am a bot' }, freshIp()),
      makeContext(),
    );
    expect(res.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports validation errors for missing fields', async () => {
    const res = await contact(makeRequest({ name: '', email: '', message: '' }, freshIp()), makeContext());
    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({
      errors: { name: expect.any(String), email: expect.any(String), message: expect.any(String) },
    });
  });

  it('rejects a malformed email address', async () => {
    const res = await contact(makeRequest({ ...validPayload, email: 'not-an-email' }, freshIp()), makeContext());
    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ errors: { email: expect.any(String) } });
  });

  it('rejects a message below the minimum length', async () => {
    const res = await contact(makeRequest({ ...validPayload, message: 'zu kurz' }, freshIp()), makeContext());
    expect(res.status).toBe(400);
    expect(res.jsonBody).toMatchObject({ errors: { message: expect.any(String) } });
  });

  it('forwards a valid submission to Brevo and reports ok', async () => {
    const res = await contact(makeRequest(validPayload, freshIp()), makeContext());
    expect(res.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns 502 when Brevo rejects the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );
    const res = await contact(makeRequest(validPayload, freshIp()), makeContext());
    expect(res.status).toBe(502);
  });

  it('returns 502 when delivery is not configured', async () => {
    delete process.env.BREVO_API_KEY;
    const res = await contact(makeRequest(validPayload, freshIp()), makeContext());
    expect(res.status).toBe(502);
  });

  it('rate-limits a client after too many submissions in the window', async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i += 1) {
      await contact(makeRequest(validPayload, ip), makeContext());
    }
    const res = await contact(makeRequest(validPayload, ip), makeContext());
    expect(res.status).toBe(429);
  });
});
