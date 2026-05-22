// ─── Database row types ───────────────────────────────────────────────────────

export interface CourseRow {
  id: string;
  name: string;
  city: string;
  par: number;
  rating: number;
  slope: number;
  image: string;
  created_at: string;
}

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

export interface ClubRow {
  id: string;
  name: string;
  type: string;
  carry: string;
  loft: string;
  shaft: string;
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
