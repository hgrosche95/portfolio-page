import { app, type HttpRequest, type HttpResponseInit, type InvocationContext } from '@azure/functions';

/**
 * Reachability probe for the two live demos: GET /api/live-status?project=...
 *
 * Both demos run their backend on Azure Container Apps with scale-to-zero.
 * After a few idle minutes the container sleeps; the first real request
 * wakes it back up and takes 30-40s. Without a warning, a visitor clicking
 * the live-demo button in that window sees nothing happen and assumes the
 * demo is broken.
 *
 * A browser can't check this directly: both backends' CORS policy only
 * allows their own frontend's origin, so a fetch from this portfolio's
 * origin would be blocked by the browser - and a CORS rejection looks
 * identical to a dead server from the client side (a network error either
 * way). This function does the request server-to-server instead, where
 * CORS does not apply.
 *
 * The target URL always comes from this fixed allowlist, never from the
 * request: this is a reachability probe for two specific, known-safe URLs,
 * not a general-purpose fetch proxy that would let a caller reach arbitrary
 * hosts through this server.
 */

type ProjectSlug = 'great-galguti-game' | 'ai-trip-planer';

const TARGETS: Record<ProjectSlug, string> = {
  // No /health route on this one; any response (even a 404) still proves
  // the process is up, see isAwake() below.
  'great-galguti-game':
    'https://great-galguti-server.redisland-e7c19e60.germanywestcentral.azurecontainerapps.io/',
  'ai-trip-planer':
    'https://trip-planner-dev-api.redisland-e7c19e60.germanywestcentral.azurecontainerapps.io/health',
};

/** Comfortably longer than a warm response, far short of a 30-40s cold start. */
const PROBE_TIMEOUT_MS = 4000;
/** Keeps several visitors hitting a project page at once from each triggering their own probe. */
const CACHE_TTL_MS = 20_000;

const cache = new Map<ProjectSlug, { awake: boolean; expiresAt: number }>();

/**
 * Best-effort, in-memory, same caveat as the contact form's limiter: a
 * serverless host may run several instances, so this throttles one noisy
 * client rather than guaranteeing a global cap. Enough for what is, worst
 * case, a way to make this server issue a few extra outbound requests to
 * two fixed and already-public URLs.
 */
const RATE_LIMIT = { max: 20, windowMs: 60 * 1000 };
const recentRequests = new Map<string, number[]>();

function isRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const hits = (recentRequests.get(clientKey) ?? []).filter((time) => now - time < RATE_LIMIT.windowMs);

  hits.push(now);
  recentRequests.set(clientKey, hits);

  if (recentRequests.size > 500) {
    for (const [key, times] of recentRequests) {
      if (times.every((time) => now - time >= RATE_LIMIT.windowMs)) recentRequests.delete(key);
    }
  }

  return hits.length > RATE_LIMIT.max;
}

function clientKeyOf(request: HttpRequest): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  return forwarded.split(',').pop()?.trim() || 'unknown';
}

/**
 * Any response - including a 404 for a path the app doesn't define - proves
 * the process is up and handling requests. Only a timeout or a connection
 * failure means "still asleep, or actually down"; either reads the same to
 * a visitor, so this doesn't try to tell them apart.
 */
async function isAwake(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return response.status < 500;
  } catch {
    return false;
  }
}

function json(status: number, body: unknown): HttpResponseInit {
  return { status, jsonBody: body };
}

export async function liveStatus(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const projectParam = request.query.get('project');
  if (!projectParam || !(projectParam in TARGETS)) {
    return json(400, { error: 'Unbekanntes Projekt.' });
  }
  const project = projectParam as ProjectSlug;

  if (isRateLimited(clientKeyOf(request))) {
    return json(429, { error: 'Zu viele Anfragen.' });
  }

  const cached = cache.get(project);
  if (cached && cached.expiresAt > Date.now()) {
    return json(200, { awake: cached.awake });
  }

  const awake = await isAwake(TARGETS[project]);
  cache.set(project, { awake, expiresAt: Date.now() + CACHE_TTL_MS });
  context.log(`live-status: ${project} -> ${awake ? 'awake' : 'asleep'}`);

  return json(200, { awake });
}

app.http('live-status', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'live-status',
  handler: liveStatus,
});
