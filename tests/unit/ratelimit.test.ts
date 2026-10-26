// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/redis", () => ({ redis: {} }));

import { getIP, rateLimitResponse, readLimiter, searchLimiter, mutateLimiter } from "@/lib/ratelimit";

afterEach(() => vi.useRealTimers());

it("constructs the three service limiters without making network requests", () => {
  for (const limiter of [readLimiter, searchLimiter, mutateLimiter]) {
    expect(limiter.limit).toBeTypeOf("function");
  }
});

it.each([
  [{ "x-forwarded-for": " 192.0.2.1, 192.0.2.2", "x-real-ip": "192.0.2.3" }, "192.0.2.1"],
  [{ "x-real-ip": "192.0.2.3" }, "192.0.2.3"],
  [{}, "anonymous"],
])("resolves client IP using header precedence", (headers, expected) => {
  expect(getIP(new NextRequest("http://localhost", { headers }))).toBe(expected);
});

it("returns a 429 with all rate-limit headers and rounds retry seconds up", () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  expect(rateLimitResponse(1_001_501, 10, 0)).toEqual({
    status: 429,
    headers: {
      "Retry-After": "2", "X-RateLimit-Limit": "10",
      "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1001501",
    },
  });
});
