/**
 * GET /api/stats
 *
 * Returns all rounds with putts and a computed handicap differential, ordered
 * oldest-first so Recharts can plot them chronologically left-to-right.
 * Responses are cached in Redis for 24 hours and invalidated by POST /api/cache/invalidate.
 *
 * Response shape: { rounds: StatRound[], source: "cache" | "supabase" }
 *
 * Handicap differential formula per round:
 *   (score − course_rating) × 113 / slope, rounded to one decimal.
 *   9-hole rounds use half the course rating.
 */
import { NextRequest, NextResponse } from "next/server";
import { redis, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";
import { supabase } from "@/lib/supabase";
import { readLimiter, getIP, rateLimitResponse } from "@/lib/ratelimit";
import { statRoundSchema } from "@/lib/schemas";
import { z } from "zod";

export type StatRound = z.infer<typeof statRoundSchema>;

export async function GET(req: NextRequest) {
  try {
    // ── Rate limit ─────────────────────────────────────────────────────────
    const { success, limit, reset, remaining } = await readLimiter.limit(getIP(req));
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        rateLimitResponse(reset, limit, remaining),
      );
    }

    // ── Try cache first ────────────────────────────────────────────────────
    const cached = await redis.get<StatRound[]>(CACHE_KEYS.statsAll);
    if (cached) {
      return NextResponse.json({ rounds: cached, source: "cache" });
    }

    // ── Cache miss — fetch from Supabase ───────────────────────────────────
    const { data, error } = await supabase
      .from("rounds")
      .select("id, date, score, par, holes, putts, courses(name, rating, slope)")
      .order("date", { ascending: true });

    if (error) {
      console.error("[/api/stats] Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 502 });
    }

    const mapped = (data ?? []).map((r: any) => {
      const rating    = (r.courses?.rating ?? 72) as number;
      const slope     = (r.courses?.slope  ?? 113) as number;
      const holes     = (r.holes ?? 18) as number;
      const adjRating = holes === 9 ? rating / 2 : rating;
      const handicap  = Math.round((r.score - adjRating) * 113 / slope * 10) / 10;
      return {
        id:       r.id,
        date:     r.date,
        course:   r.courses?.name ?? "Unknown",
        score:    r.score,
        par:      r.par,
        holes:    holes === 9 ? 9 : 18,
        putts:    r.putts ?? 0,
        handicap,
      };
    });

    const parsed = statRoundSchema.array().safeParse(mapped);
    if (!parsed.success) {
      console.error("[/api/stats] Data shape error:", parsed.error.flatten());
      return NextResponse.json({ error: "Data integrity error" }, { status: 502 });
    }

    // ── Populate cache ─────────────────────────────────────────────────────
    await redis.set(CACHE_KEYS.statsAll, parsed.data, { ex: CACHE_TTL });

    return NextResponse.json({ rounds: parsed.data, source: "supabase" });
  } catch (err) {
    console.error("[/api/stats] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
