/**
 * In-memory, fixed-window rate limiter for API routes.
 *
 * Zero dependencies and no external store: counters live in module scope,
 * so limits are per server instance and reset on redeploy. That's the right
 * trade-off for a free tool — it stops scripted abuse and bandwidth theft
 * without adding Redis. If the app ever runs many serverless instances,
 * swap the Maps for a shared store behind the same interface.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_TRACKED_KEYS = 20_000;

function prune(map: Map<string, Bucket>, now: number) {
  if (map.size < MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of map) {
    if (bucket.resetAt <= now) map.delete(key);
  }
  // Still over the cap after pruning expired entries? Drop oldest wholesale
  // rather than letting a spoofed-IP flood grow memory forever.
  if (map.size >= MAX_TRACKED_KEYS) map.clear();
}

function consume(map: Map<string, Bucket>, key: string, limit: number, windowMs: number, now: number) {
  prune(map, now);
  const bucket = map.get(key);
  if (!bucket || bucket.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterS: 0 };
  }
  bucket.count++;
  if (bucket.count > limit) {
    return { ok: false, retryAfterS: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterS: 0 };
}

export interface RateVerdict {
  ok: boolean;
  /** Seconds until the caller may retry (0 when ok). */
  retryAfterS: number;
  /** Human-readable reason for a denial. */
  message?: string;
}

export interface RateLimiterOptions {
  /** Requests allowed per minute (burst guard). */
  perMinute: number;
  /** Requests allowed per 24h (quota). */
  perDay: number;
}

/** Create an isolated two-window limiter (per-minute burst + daily quota). */
export function createRateLimiter({ perMinute, perDay }: RateLimiterOptions) {
  const minuteWindow = new Map<string, Bucket>();
  const dayWindow = new Map<string, Bucket>();

  return function check(key: string): RateVerdict {
    const now = Date.now();
    const day = consume(dayWindow, key, perDay, 24 * 60 * 60 * 1000, now);
    if (!day.ok) {
      return {
        ok: false,
        retryAfterS: day.retryAfterS,
        message: `Daily limit reached (${perDay} lookups per day). Come back tomorrow.`,
      };
    }
    const minute = consume(minuteWindow, key, perMinute, 60 * 1000, now);
    if (!minute.ok) {
      return {
        ok: false,
        retryAfterS: minute.retryAfterS,
        message: "Slow down a little — try again in a minute.",
      };
    }
    return { ok: true, retryAfterS: 0 };
  };
}

/** Best-effort client IP behind common proxies (Vercel, nginx, Cloudflare). */
export function clientIpFrom(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
