import { NextResponse } from "next/server";
import { redis, CACHE_KEYS } from "@/lib/redis";

export async function POST() {
  await redis.del(
    CACHE_KEYS.homeStats,
    CACHE_KEYS.homeRecent,
    CACHE_KEYS.roundsAll,
    CACHE_KEYS.statsAll,
  );

  return NextResponse.json({ invalidated: true });
}
