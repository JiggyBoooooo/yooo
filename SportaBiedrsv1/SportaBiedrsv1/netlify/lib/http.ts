export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });

const buckets = globalThis as typeof globalThis & {
  __sbApiRate?: Map<string, { started: number; count: number }>;
};
buckets.__sbApiRate ??= new Map();

export function clientIp(request: Request) {
  return (request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || 'unknown')
    .split(',')[0].trim().slice(0, 120);
}

export function rateLimit(request: Request, limit = 60, windowMs = 60_000, scope = 'api') {
  const key = `${scope}:${clientIp(request)}`;
  const now = Date.now();
  const map = buckets.__sbApiRate!;
  const hit = map.get(key);
  if (!hit || now - hit.started >= windowMs) {
    map.set(key, { started: now, count: 1 });
  } else {
    hit.count += 1;
    if (hit.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((hit.started + windowMs - now) / 1000));
      return json(429, { error: 'Too many requests. Please try again shortly.', code: 'RATE_LIMITED' }, { 'retry-after': String(retryAfter) });
    }
  }
  // Avoid an unbounded in-memory map in long-lived local/serverless workers.
  if (map.size > 2000) {
    for (const [k, v] of map) {
      if (now - v.started >= windowMs) map.delete(k);
      if (map.size <= 1500) break;
    }
  }
  return null;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (origin) return origin === new URL(request.url).origin;
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site' && fetchSite !== 'none') return false;
  return true;
}

export function cleanText(value: unknown, max = 500) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
