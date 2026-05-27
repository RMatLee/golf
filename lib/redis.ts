/**
 * Upstash Redis client and cache configuration.
 *
 * All API read routes (home, rounds, stats) cache their Supabase responses here
 * for 24 hours. The cache is invalidated wholesale via `POST /api/cache/invalidate`
 * whenever a new round is logged. Courses and clubs are not cached.
 */
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL   ?? "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

// All cache keys in one place — easy to find and invalidate
export const CACHE_KEYS = {
  homeStats:   "home:stats",
  homeRecent:  "home:recent",
  roundsAll:   "rounds:all",
  statsAll:    "stats:all",
} as const;

// 24-hour TTL — data only changes when a round is logged
export const CACHE_TTL = 60 * 60 * 24;
