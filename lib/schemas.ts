/**
 * Zod schemas — single source of truth for all API data shapes.
 *
 * Request schemas validate incoming query parameters before any work is done.
 * Response schemas validate data *after* it has been mapped from raw Supabase rows,
 * immediately before caching or returning — a mismatch indicates a data-integrity
 * problem and should be surfaced as a 502, not silently swallowed.
 */
import { z } from "zod";

// ── Request schemas ────────────────────────────────────────────────────────────

export const courseSearchQuerySchema = z.object({
  q: z.string().min(2, "Query must be at least 2 characters").max(100, "Query too long").trim(),
});

// ── Output/response schemas ────────────────────────────────────────────────────
// These validate the data shape after mapping from Supabase rows.
// If a row doesn't match, it's a data-integrity problem — logged as 502.

export const googlePlacesResponseSchema = z.object({
  places: z.array(z.object({
    id: z.string().min(1),
    displayName: z.object({ text: z.string().min(1) }),
    formattedAddress: z.string().optional(),
  })).default([]),
});

export const roundItemSchema = z.object({
  id:     z.string(),
  date:   z.string(),
  course: z.string(),
  score:  z.number().int().min(15).max(200),
  par:    z.number().int().min(27).max(80),
  holes:  z.union([z.literal(9), z.literal(18)]),
});

export const statRoundSchema = roundItemSchema.extend({
  putts:    z.number().int().min(0).max(80),
  handicap: z.number().min(-10).max(60),
});

export const recentRoundSchema = roundItemSchema;

export const homeStatsSchema = z.object({
  lastScore:    z.string(),
  lastCourse:   z.string(),
  handicap:     z.string(),
  roundsPlayed: z.string(),
});
