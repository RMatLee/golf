import { NextRequest, NextResponse } from "next/server";
import { redis, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";
import { supabase } from "@/lib/supabase";
import { readLimiter, getIP, rateLimitResponse } from "@/lib/ratelimit";

export interface StatRound {
  id:       string;
  date:     string;
  course:   string;
  score:    number;
  par:      number;
  putts:    number;
  handicap: number;
}

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
      .select("id, date, score, par, putts, handicap, courses(name)")
      .order("date", { ascending: true });

    if (error) {
      console.error("[/api/stats] Supabase error:", error);
      return NextResponse.json({ error: "Failed to fetch stats" }, { status: 502 });
    }

    const rounds: StatRound[] = (data ?? []).map((r: any) => ({
      id:       r.id,
      date:     r.date,
      course:   r.courses?.name ?? "Unknown",
      score:    r.score,
      par:      r.par,
      putts:    r.putts    ?? 0,
      handicap: r.handicap ?? 0,
    }));

    // ── Populate cache ─────────────────────────────────────────────────────
    await redis.set(CACHE_KEYS.statsAll, rounds, { ex: CACHE_TTL });

    return NextResponse.json({ rounds, source: "supabase" });
  } catch (err) {
    console.error("[/api/stats] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
