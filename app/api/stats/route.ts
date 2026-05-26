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
      .select("id, date, score, par, holes, putts, handicap, courses(name)")
      .order("date", { ascending: true });

    if (error) {
      console.error("[/api/stats] Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 502 });
    }

    const mapped = (data ?? []).map((r: any) => ({
      id:       r.id,
      date:     r.date,
      course:   r.courses?.name ?? "Unknown",
      score:    r.score,
      par:      r.par,
      holes:    r.holes    ?? 18,
      putts:    r.putts    ?? 0,
      handicap: r.handicap ?? 0,
    }));

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
