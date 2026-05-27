/**
 * GET /api/home
 *
 * Returns the stat strip values and the 3 most recent rounds for the home page.
 * Responses are cached in Redis for 24 hours and invalidated by POST /api/cache/invalidate.
 *
 * Response shape: { stats: HomeStats, recentRounds: RecentRound[], source: "cache" | "supabase" }
 *
 * The handicap differential is computed here using the USGA formula:
 *   (score − course_rating) × 113 / slope, rounded to one decimal.
 *   For 9-hole rounds, course_rating is halved before the calculation.
 */
import { NextRequest, NextResponse } from "next/server";
import { redis, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";
import { supabase } from "@/lib/supabase";
import { readLimiter, getIP, rateLimitResponse } from "@/lib/ratelimit";
import { homeStatsSchema, recentRoundSchema } from "@/lib/schemas";
import { z } from "zod";

export type HomeStats   = z.infer<typeof homeStatsSchema>;
export type RecentRound = z.infer<typeof recentRoundSchema>;

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
    const [cachedStats, cachedRecent] = await Promise.all([
      redis.get<HomeStats>(CACHE_KEYS.homeStats),
      redis.get<RecentRound[]>(CACHE_KEYS.homeRecent),
    ]);

    if (cachedStats && cachedRecent) {
      return NextResponse.json({ stats: cachedStats, recentRounds: cachedRecent, source: "cache" });
    }

    // ── Cache miss — fetch from Supabase ───────────────────────────────────
    const [{ data: latestRound, error: e1 }, { count, error: e2 }, { data: recentData, error: e3 }] =
      await Promise.all([
        supabase.from("rounds").select("score, holes, courses(name, rating, slope)").order("date", { ascending: false }).limit(1),
        supabase.from("rounds").select("*", { count: "exact", head: true }),
        supabase.from("rounds").select("id, date, score, par, holes, courses(name)").order("date", { ascending: false }).limit(3),
      ]);

    if (e1 || e2 || e3) {
      console.error("[/api/home] Supabase error:", e1 ?? e2 ?? e3);
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 502 });
    }

    const latest = latestRound?.[0] as any;

    let handicapStr = "—";
    if (latest) {
      const rating    = (latest.courses?.rating ?? null) as number | null;
      const slope     = (latest.courses?.slope  ?? null) as number | null;
      if (rating && slope) {
        const adjRating = (latest.holes ?? 18) === 9 ? rating / 2 : rating;
        handicapStr = String(Math.round((latest.score - adjRating) * 113 / slope * 10) / 10);
      }
    }

    const rawStats = {
      lastScore:    latest ? String(latest.score) : "—",
      lastCourse:   (latest as any)?.courses?.name ?? "—",
      handicap:     handicapStr,
      roundsPlayed: count != null ? String(count) : "—",
    };

    const rawRecent = (recentData ?? []).map((r: any) => ({
      id:     r.id,
      date:   r.date,
      score:  r.score,
      par:    r.par,
      holes:  r.holes ?? 18,
      course: r.courses?.name ?? "Unknown",
    }));

    const parsedStats  = homeStatsSchema.safeParse(rawStats);
    const parsedRecent = recentRoundSchema.array().safeParse(rawRecent);

    if (!parsedStats.success || !parsedRecent.success) {
      console.error("[/api/home] Data shape error:", parsedStats.error?.flatten(), parsedRecent.error?.flatten());
      return NextResponse.json({ error: "Data integrity error" }, { status: 502 });
    }

    // ── Populate cache ─────────────────────────────────────────────────────
    await Promise.all([
      redis.set(CACHE_KEYS.homeStats,  parsedStats.data,   { ex: CACHE_TTL }),
      redis.set(CACHE_KEYS.homeRecent, parsedRecent.data,  { ex: CACHE_TTL }),
    ]);

    return NextResponse.json({ stats: parsedStats.data, recentRounds: parsedRecent.data, source: "supabase" });
  } catch (err) {
    console.error("[/api/home] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
