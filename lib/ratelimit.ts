/**
 * Upstash rate limiter instances and request-utility helpers.
 *
 * Three sliding-window limiters with different thresholds are exported so that
 * each API route can import the limiter appropriate for its cost profile:
 *  - `readLimiter`   — cached reads; generous limit, cheap to serve
 *  - `searchLimiter` — Google Places proxy; tight limit, each miss costs an API call
 *  - `mutateLimiter` — cache invalidation; tightest, only fires after a round insert
 *
 * All limiters use per-IP keying via `getIP()`. `rateLimitResponse()` builds the
 * 429 response object with standard `Retry-After` and `X-RateLimit-*` headers.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { NextRequest } from "next/server";
import { redis } from "./redis";

// Public read routes — generous, cached responses are cheap
export const readLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix:  "rl:read",
  analytics: true,
});

// Google Places search — each miss costs an API call
export const searchLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  prefix:  "rl:search",
  analytics: true,
});

// Cache invalidation — only fires after logging a round
export const mutateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix:  "rl:mutate",
  analytics: true,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves the real client IP from `x-forwarded-for` (set by proxies/CDN) or
 * `x-real-ip`, falling back to `"anonymous"` when neither header is present.
 */
export function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous"
  );
}

/**
 * Builds a 429 response config with standard rate-limit headers.
 * Pass directly to `NextResponse.json(body, rateLimitResponse(...))`.
 */
export function rateLimitResponse(reset: number, limit: number, remaining: number) {
  return {
    status: 429,
    headers: {
      "Retry-After":         String(Math.ceil((reset - Date.now()) / 1000)),
      "X-RateLimit-Limit":   String(limit),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset":   String(reset),
    },
  } as const;
}
