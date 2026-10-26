// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ del: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/redis", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/redis")>(),
  redis: { del: mocks.del },
}));
vi.mock("@/lib/ratelimit", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/ratelimit")>(),
  mutateLimiter: { limit: mocks.limit },
}));
import { POST } from "@/app/api/cache/invalidate/route";

beforeEach(() => {
  mocks.limit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: Date.now() + 60_000 });
  mocks.del.mockResolvedValue(4);
});

const request = () => new NextRequest("http://localhost/api/cache/invalidate", {
  method: "POST", headers: { "x-real-ip": "192.0.2.1" },
});

it("invalidates every read cache key after an allowed request", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ invalidated: true });
  expect(mocks.limit).toHaveBeenCalledWith("192.0.2.1");
  expect(mocks.del).toHaveBeenCalledExactlyOnceWith("home:stats", "home:recent", "rounds:all", "stats:all");
});

it("returns rate-limit headers and does not delete keys when denied", async () => {
  mocks.limit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: Date.now() + 60_000 });
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: "Too many requests" });
  expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
  expect(response.headers.get("Retry-After")).toBeTruthy();
  expect(mocks.del).not.toHaveBeenCalled();
});

it.each(["redis", "limiter"])("logs and returns 500 on a %s failure", async (service) => {
  const error = new Error(`${service} unavailable`);
  (service === "redis" ? mocks.del : mocks.limit).mockRejectedValue(error);
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Failed to invalidate cache" });
  expect(log).toHaveBeenCalledWith("[/api/cache/invalidate] Unexpected error:", error);
});
