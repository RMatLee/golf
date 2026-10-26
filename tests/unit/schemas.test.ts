import { describe, expect, it } from "vitest";
import {
  courseSearchQuerySchema, googlePlacesResponseSchema, homeStatsSchema,
  recentRoundSchema, roundItemSchema, statRoundSchema,
} from "@/lib/schemas";

const round = {
  id: "round-1", date: "2026-10-20", course: "Test Links",
  score: 84, par: 72, holes: 18,
};

describe("API schemas", () => {
  it("validates and trims course searches at the length boundaries", () => {
    expect(courseSearchQuerySchema.parse({ q: "  Test Links  " })).toEqual({ q: "Test Links" });
    for (const q of ["ab", "a".repeat(100)]) {
      expect(courseSearchQuerySchema.safeParse({ q }).success).toBe(true);
    }
    for (const q of ["a", "a".repeat(101), 42, null]) {
      expect(courseSearchQuerySchema.safeParse({ q }).success).toBe(false);
    }
  });

  it("accepts absent Places results and optional addresses", () => {
    expect(googlePlacesResponseSchema.parse({})).toEqual({ places: [] });
    expect(googlePlacesResponseSchema.parse({
      places: [{ id: "place-1", displayName: { text: "Test Links" } }],
    }).places).toHaveLength(1);
    expect(googlePlacesResponseSchema.safeParse({
      places: [{ id: "", displayName: { text: "" } }],
    }).success).toBe(false);
  });

  it.each([9, 18])("accepts %i-hole rounds and recent rounds", (holes) => {
    expect(roundItemSchema.parse({ ...round, holes })).toEqual({ ...round, holes });
    expect(recentRoundSchema.parse({ ...round, holes })).toEqual({ ...round, holes });
  });

  it.each([
    { score: 14 }, { score: 201 }, { score: 84.5 }, { score: "84" },
    { par: 26 }, { par: 81 }, { par: 72.5 }, { holes: 12 }, { date: null },
  ])("rejects invalid round fields %j", (fields) => {
    expect(roundItemSchema.safeParse({ ...round, ...fields }).success).toBe(false);
  });

  it("accepts inclusive scoring limits", () => {
    for (const fields of [{ score: 15, par: 27 }, { score: 200, par: 80 }]) {
      expect(roundItemSchema.safeParse({ ...round, ...fields }).success).toBe(true);
    }
  });

  it("validates statistics limits and required fields", () => {
    for (const fields of [{ putts: 0, handicap: -10 }, { putts: 80, handicap: 60 }]) {
      expect(statRoundSchema.safeParse({ ...round, ...fields }).success).toBe(true);
    }
    for (const fields of [
      { putts: -1, handicap: 10 }, { putts: 81, handicap: 10 },
      { putts: 30.5, handicap: 10 }, { putts: 30, handicap: -11 },
      { putts: 30, handicap: 61 }, {},
    ]) {
      expect(statRoundSchema.safeParse({ ...round, ...fields }).success).toBe(false);
    }
  });

  it("requires string-valued dashboard stats, including empty-state placeholders", () => {
    const stats = { lastScore: "84", lastCourse: "Test Links", handicap: "10.2", roundsPlayed: "1" };
    expect(homeStatsSchema.parse(stats)).toEqual(stats);
    expect(homeStatsSchema.safeParse({ ...stats, lastScore: 84 }).success).toBe(false);
    expect(homeStatsSchema.safeParse({}).success).toBe(false);
    expect(homeStatsSchema.safeParse({
      lastScore: "—", lastCourse: "—", handicap: "—", roundsPlayed: "0",
    }).success).toBe(true);
  });
});
