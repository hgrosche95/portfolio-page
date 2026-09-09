import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpRequest, InvocationContext } from '@azure/functions';

function makeRequest(project: string | null, ip: string): HttpRequest {
  return {
    query: { get: (key: string) => (key === 'project' ? project : null) },
    headers: { get: (name: string) => (name === 'x-forwarded-for' ? ip : null) },
  } as unknown as HttpRequest;
}

function makeContext(): InvocationContext {
  return { log: vi.fn(), error: vi.fn() } as unknown as InvocationContext;
}

let nextIp = 1;
function freshIp(): string {
  nextIp += 1;
  return `198.51.100.${nextIp}`;
}

// live-status.ts keeps its cache and rate-limit state at module scope, the
// same pattern contact.ts already uses. A static top-level import would
// share that state across every test in this file; resetting modules and
// re-importing per test gives each one its own, matching how a fresh
// function-app instance actually starts out.
async function freshLiveStatus() {
  vi.resetModules();
  const mod = await import('./live-status');
  return mod.liveStatus;
}

describe('liveStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('rejects a project not on the allowlist', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const liveStatus = await freshLiveStatus();
    const res = await liveStatus(makeRequest('not-a-real-project', freshIp()), makeContext());
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a missing project parameter', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const liveStatus = await freshLiveStatus();
    const res = await liveStatus(makeRequest(null, freshIp()), makeContext());
    expect(res.status).toBe(400);
  });

  it('never fetches a URL supplied by the caller: only the allowlisted target', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const liveStatus = await freshLiveStatus();
    await liveStatus(makeRequest('great-galguti-game', freshIp()), makeContext());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('great-galguti-server'),
      expect.anything(),
    );
  });

  it('reports awake when the backend responds, even with a 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    const liveStatus = await freshLiveStatus();
    const res = await liveStatus(makeRequest('great-galguti-game', freshIp()), makeContext());
    expect(res.status).toBe(200);
    expect(res.jsonBody).toEqual({ awake: true });
  });

  it('reports asleep when the backend times out or is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch failed');
      }),
    );
    const liveStatus = await freshLiveStatus();
    const res = await liveStatus(makeRequest('ai-trip-planer', freshIp()), makeContext());
    expect(res.jsonBody).toEqual({ awake: false });
  });

  it('reports asleep on a 5xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    const liveStatus = await freshLiveStatus();
    const res = await liveStatus(makeRequest('ai-trip-planer', freshIp()), makeContext());
    expect(res.jsonBody).toEqual({ awake: false });
  });

  it('caches the result instead of probing again within the TTL', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const liveStatus = await freshLiveStatus();
    const ip = freshIp();

    await liveStatus(makeRequest('great-galguti-game', ip), makeContext());
    await liveStatus(makeRequest('great-galguti-game', ip), makeContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('probes again once the cache entry has expired', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const liveStatus = await freshLiveStatus();
    const ip = freshIp();

    await liveStatus(makeRequest('great-galguti-game', ip), makeContext());
    vi.advanceTimersByTime(21_000);
    await liveStatus(makeRequest('great-galguti-game', ip), makeContext());

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rate-limits a client after too many requests in the window', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 200 })),
    );
    const liveStatus = await freshLiveStatus();
    const ip = freshIp();

    // Distinct projects per call so the cache can't short-circuit a fetch -
    // the rate limiter runs before the cache check regardless, but keeping
    // both real allowlisted values in play is closer to real traffic.
    const projects: ('great-galguti-game' | 'ai-trip-planer')[] = [
      'great-galguti-game',
      'ai-trip-planer',
    ];
    for (let i = 0; i < 20; i += 1) {
      await liveStatus(makeRequest(projects[i % 2], ip), makeContext());
    }
    const res = await liveStatus(makeRequest('great-galguti-game', ip), makeContext());
    expect(res.status).toBe(429);
  });
});
