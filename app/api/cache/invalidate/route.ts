/**
 * POST /api/cache/invalidate
 *
 * Deletes all four Redis cache keys in a single call, forcing the next read to
 * re-fetch from Supabase. Called by the client immediately after a round is
 * inserted so the home page, rounds list, and stats charts reflect the new data
 * without waiting for the 24-hour TTL to expire.
 *
 * Response shape: { invalidated: true }
 */
import { NextRequest, NextResponse } from "next/server";
import { redis, CACHE_KEYS } from "@/lib/redis";
import { mutateLimiter, getIP, rateLimitResponse } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit ─────────────────────────────────────────────────────────
    const { success, limit, reset, remaining } = await mutateLimiter.limit(getIP(req));
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        rateLimitResponse(reset, limit, remaining),
      );
    }

    await redis.del(
      CACHE_KEYS.homeStats,
      CACHE_KEYS.homeRecent,
      CACHE_KEYS.roundsAll,
      CACHE_KEYS.statsAll,
    );

    return NextResponse.json({ invalidated: true });
  } catch (err) {
    console.error("[/api/cache/invalidate] Unexpected error:", err);
    return NextResponse.json({ error: "Failed to invalidate cache" }, { status: 500 });
  }
}
