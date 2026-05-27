/**
 * Shared TypeScript types for the Golf Tracker application.
 *
 * Database row interfaces mirror the Supabase table schemas exactly so that
 * query results can be cast without runtime conversion. The `Database` interface
 * types Insert/Update payloads, while app-level types cover UI and display logic.
 */

// ─── Database row types ───────────────────────────────────────────────────────

/** Matches the `courses` table schema, including optional 9-hole split columns. */
export interface CourseRow {
  id: string;
  name: string;
  city: string;
  par: number;
  rating: number;
  slope: number;
  image: string;
  front_par:    number | null;
  front_rating: number | null;
  front_slope:  number | null;
  back_par:     number | null;
  back_rating:  number | null;
  back_slope:   number | null;
  created_at: string;
}

/** Matches the `rounds` table schema. `handicap` is computed at insert time from course rating/slope. */
export interface RoundRow {
  id: string;
  date: string;
  course_id: string | null;
  score: number;
  par: number;
  putts: number | null;
  handicap: number | null;
  created_at: string;
}

/** Matches the `clubs` table schema. `media_url` is a Supabase Storage public URL or null. */
export interface ClubRow {
  id: string;
  name: string;
  type: string;
  carry: string;
  loft: string;
  shaft: string;
  media_url: string | null;
  created_at: string;
}

// ─── Supabase Database schema (used to type the client) ───────────────────────

export interface Database {
  public: {
    Tables: {
      courses: {
        Row: CourseRow;
        Insert: Omit<CourseRow, "id" | "created_at">;
        Update: Partial<Omit<CourseRow, "id" | "created_at">>;
      };
      rounds: {
        Row: RoundRow;
        Insert: Omit<RoundRow, "id" | "created_at">;
        Update: Partial<Omit<RoundRow, "id" | "created_at">>;
      };
      clubs: {
        Row: ClubRow;
        Insert: Omit<ClubRow, "id" | "created_at">;
        Update: Partial<Omit<ClubRow, "id" | "created_at">>;
      };
    };
  };
}

// ─── App-level types (used across pages) ─────────────────────────────────────

export type ClubType = "Driver" | "Fairway Woods" | "Hybrids" | "Irons" | "Wedges" | "Putter";

// ─── Scramble types ───────────────────────────────────────────────────────────

/** Matches the `scramble_players` table. Players are created on first match appearance and reused by name. */
export interface ScramblePlayerRow {
  id: string;
  name: string;
  created_at: string;
}

/**
 * Matches the `scramble_rounds` table.
 * p1+p2 form Team 1; p3+p4 form Team 2. p1 and p3 are required; p2 and p4 are optional.
 * Points are NOT stored here — they are derived at read time by counting wins in the API route.
 */
export interface ScrambleRoundRow {
  id: string;
  date: string;
  course: string;
  p1_id: string;
  p2_id: string | null;
  p3_id: string | null;
  p4_id: string | null;
  team1_score: number;
  team2_score: number;
  created_at: string;
}
