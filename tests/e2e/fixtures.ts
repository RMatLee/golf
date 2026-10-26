import { test as base, expect } from "@playwright/test";
import type { CourseRow } from "@/lib/types";

export const course: CourseRow = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Test Links", city: "Madison, WI", par: 72, rating: 71.5, slope: 125,
  image: "", front_par: 35, front_rating: 35.1, front_slope: 120,
  back_par: 37, back_rating: 36.4, back_slope: 130,
  created_at: "2026-01-01T00:00:00Z",
};

const round = {
  id: "round-1", date: "2026-10-20", course: course.name, course_id: course.id,
  score: 84, par: 72, holes: 18, putts: 30, handicap: 11.3,
};
const user = {
  id: "00000000-0000-4000-8000-000000000002", aud: "authenticated",
  role: "authenticated", email: "admin@example.test",
  app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const session = () => ({
  access_token: "test-access-token", refresh_token: "test-refresh-token",
  expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer", user,
});

interface MockState {
  roundWrites: Record<string, unknown>[];
  invalidations: number;
  failRoundWrite: boolean;
  failLogin: boolean;
  failHome: boolean;
}

export const test = base.extend<{ backend: MockState }>({
  backend: [async ({ context, baseURL }, provideBackend) => {
    const state: MockState = {
      roundWrites: [], invalidations: 0, failRoundWrite: false,
      failLogin: false, failHome: false,
    };
    const unexpected: string[] = [];
    const pageErrors: string[] = [];
    context.on("page", (page) => page.on("pageerror", (error) => pageErrors.push(error.message)));

    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      if (url.origin === baseURL) {
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (url.pathname === "/api/home" && method === "GET") {
          return route.fulfill({
            status: state.failHome ? 502 : 200,
            json: state.failHome ? { error: "Service unavailable" } : {
              stats: { lastScore: "84", lastCourse: course.name, handicap: "11.3", roundsPlayed: "1" },
              recentRounds: [round], source: "cache",
            },
          });
        }
        if (["/api/rounds", "/api/stats"].includes(url.pathname) && method === "GET") {
          return route.fulfill({ json: { rounds: [round], source: "cache" } });
        }
        if (url.pathname === "/api/scrambles" && method === "GET") {
          return route.fulfill({ json: { players: [], rounds: [] } });
        }
        if (url.pathname === "/api/courses/search" && method === "GET") {
          return route.fulfill({ json: { results: [], configured: false } });
        }
        if (url.pathname === "/api/cache/invalidate" && method === "POST") {
          state.invalidations++;
          return route.fulfill({ json: { invalidated: true } });
        }
      } else if (url.origin === "https://golf-test.supabase.co") {
        if (url.pathname === "/auth/v1/token" && method === "POST") {
          expect(request.postDataJSON()).toMatchObject({
            email: "admin@example.test", password: "test-password",
          });
          return route.fulfill({
            status: state.failLogin ? 400 : 200,
            json: state.failLogin
              ? { error: "invalid_grant", error_description: "Invalid login credentials" }
              : session(),
          });
        }
        if (url.pathname === "/auth/v1/user" && method === "GET") {
          return route.fulfill({ json: user });
        }
        if (url.pathname === "/rest/v1/courses" && method === "GET") {
          return route.fulfill({ json: [course] });
        }
        if (url.pathname === "/rest/v1/clubs" && method === "GET") {
          return route.fulfill({ json: [] });
        }
        if (url.pathname === "/rest/v1/rounds" && method === "GET") {
          return route.fulfill({ json: [round] });
        }
        if (url.pathname === "/rest/v1/rounds" && method === "POST") {
          state.roundWrites.push(request.postDataJSON());
          return route.fulfill({
            status: state.failRoundWrite ? 500 : 201,
            json: state.failRoundWrite ? { message: "Test insert failure" } : null,
          });
        }
      }
      unexpected.push(`${method} ${url.origin}${url.pathname}`);
      await route.abort("blockedbyclient");
    });
    await provideBackend(state);
    expect(unexpected, "Unmocked requests must never reach external services or API routes").toEqual([]);
    expect(pageErrors, "Pages should not throw uncaught errors").toEqual([]);
  }, { auto: true }],
});

export { expect } from "@playwright/test";
