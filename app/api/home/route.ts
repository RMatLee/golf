import { NextResponse } from "next/server";
import { redis, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";
import { supabase } from "@/lib/supabase";

export interface HomeStats {
  lastScore:    string;
  lastCourse:   string;
  handicap:     string;
  roundsPlayed: string;
}

export interface RecentRound {
  id:     string;
  date:   string;
  course: string;
  score:  number;
  par:    number;
}

export async function GET() {
  // ── Try cache first ──────────────────────────────────────────────────────
  const [cachedStats, cachedRecent] = await Promise.all([
    redis.get<HomeStats>(CACHE_KEYS.homeStats),
    redis.get<RecentRound[]>(CACHE_KEYS.homeRecent),
  ]);

  if (cachedStats && cachedRecent) {
    return NextResponse.json({ stats: cachedStats, recentRounds: cachedRecent, source: "cache" });
  }

  // ── Cache miss — fetch from Supabase ─────────────────────────────────────
  const [{ data: latestRound }, { count }, { data: recentData }] = await Promise.all([
    supabase
      .from("rounds")
      .select("score, handicap, courses(name)")
      .order("date", { ascending: false })
      .limit(1),
    supabase
      .from("rounds")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("rounds")
      .select("id, date, score, par, courses(name)")
      .order("date", { ascending: false })
      .limit(3),
  ]);

  const latest = latestRound?.[0] as any;

  const stats: HomeStats = {
    lastScore:    latest ? String(latest.score)              : "—",
    lastCourse:   latest?.courses?.name                      ?? "—",
    handicap:     latest?.handicap != null ? String(latest.handicap) : "—",
    roundsPlayed: count != null ? String(count)              : "—",
  };

  const recentRounds: RecentRound[] = (recentData ?? []).map((r: any) => ({
    id:     r.id,
    date:   r.date,
    score:  r.score,
    par:    r.par,
    course: r.courses?.name ?? "Unknown",
  }));

  // ── Populate cache ────────────────────────────────────────────────────────
  await Promise.all([
    redis.set(CACHE_KEYS.homeStats,  stats,        { ex: CACHE_TTL }),
    redis.set(CACHE_KEYS.homeRecent, recentRounds, { ex: CACHE_TTL }),
  ]);

  return NextResponse.json({ stats, recentRounds, source: "supabase" });
}
