import { NextResponse } from "next/server";
import { redis, CACHE_KEYS, CACHE_TTL } from "@/lib/redis";
import { supabase } from "@/lib/supabase";

export interface RoundItem {
  id:     string;
  date:   string;
  course: string;
  score:  number;
  par:    number;
}

export async function GET() {
  // ── Try cache first ──────────────────────────────────────────────────────
  const cached = await redis.get<RoundItem[]>(CACHE_KEYS.roundsAll);

  if (cached) {
    return NextResponse.json({ rounds: cached, source: "cache" });
  }

  // ── Cache miss — fetch from Supabase ─────────────────────────────────────
  const { data } = await supabase
    .from("rounds")
    .select("id, date, score, par, courses(name)")
    .order("date", { ascending: false });

  const rounds: RoundItem[] = (data ?? []).map((r: any) => ({
    id:     r.id,
    date:   r.date,
    score:  r.score,
    par:    r.par,
    course: r.courses?.name ?? "Unknown",
  }));

  // ── Populate cache ────────────────────────────────────────────────────────
  await redis.set(CACHE_KEYS.roundsAll, rounds, { ex: CACHE_TTL });

  return NextResponse.json({ rounds, source: "supabase" });
}
