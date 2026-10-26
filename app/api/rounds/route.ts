/**
 * GET /api/rounds
 *
 * Returns all logged rounds, ordered newest-first, for the rounds history page.
 * Responses are cached in Redis for 24 hours and invalidated by POST /api/cache/invalidate.
 *
 * Response shape: { rounds: RoundItem[], source: "cache" | "supabase" }
 */
import { NextRequest, NextResponse } from "next/server";
import { redis, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";
import { supabase } from "@/lib/supabase";
import { readLimiter, getIP, rateLimitResponse } from "@/lib/ratelimit";
import { roundItemSchema } from "@/lib/schemas";
import { z } from "zod";
import type { CourseRow, RoundRow } from "@/lib/types";

export type RoundItem = z.infer<typeof roundItemSchema>;
type RoundQueryRow = Pick<RoundRow, "id" | "date" | "score" | "par"> & {
  holes: number | null;
  courses: Pick<CourseRow, "name"> | null;
};

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
    const cached = await redis.get<RoundItem[]>(CACHE_KEYS.roundsAll);
    if (cached) {
      return NextResponse.json({ rounds: cached, source: "cache" });
    }

    // ── Cache miss — fetch from Supabase ───────────────────────────────────
    const { data, error } = await supabase
      .from("rounds")
      .select("id, date, score, par, holes, courses(name)")
      .order("date", { ascending: false })
      .returns<RoundQueryRow[]>();

    if (error) {
      console.error("[/api/rounds] Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch rounds" }, { status: 502 });
    }

    const mapped = (data ?? []).map((r) => ({
      id:     r.id,
      date:   r.date,
      score:  r.score,
      par:    r.par,
      holes:  r.holes ?? 18,
      course: r.courses?.name ?? "Unknown",
    }));

    const parsed = roundItemSchema.array().safeParse(mapped);
    if (!parsed.success) {
      console.error("[/api/rounds] Data shape error:", parsed.error.flatten());
      return NextResponse.json({ error: "Data integrity error" }, { status: 502 });
    }

    // ── Populate cache ─────────────────────────────────────────────────────
    await redis.set(CACHE_KEYS.roundsAll, parsed.data, { ex: CACHE_TTL });

    return NextResponse.json({ rounds: parsed.data, source: "supabase" });
  } catch (err) {
    console.error("[/api/rounds] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
