/**
 * GET /api/scrambles
 *
 * Returns all scramble players with their total win points, and all processed
 * match rounds. Points are computed dynamically at request time — not stored in
 * the database — by scanning every round and crediting 1 point to the winning team.
 * This keeps the schema simple at the cost of a full table scan per request.
 * The route is intentionally not cached because matches are infrequent and the
 * dataset is small.
 *
 * Response shape: { players: { id, name, points }[], rounds: ProcessedRound[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { readLimiter, getIP, rateLimitResponse } from "@/lib/ratelimit";
import type { ScramblePlayerRow, ScrambleRoundRow } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { success, limit, reset, remaining } = await readLimiter.limit(getIP(req));
  if (!success) return rateLimitResponse(reset, limit, remaining);

  try {
    const [{ data: rounds, error: roundsError }, { data: players, error: playersError }] =
      await Promise.all([
        supabase.from("scramble_rounds").select("*").order("date", { ascending: false }),
        supabase.from("scramble_players").select("*").order("name"),
      ]);

    if (roundsError || playersError) {
      return NextResponse.json({ error: "Failed to fetch scramble data" }, { status: 502 });
    }

    const playerMap = new Map<string, string>(
      (players as ScramblePlayerRow[]).map((p) => [p.id, p.name])
    );

    const pointsMap = new Map<string, { name: string; points: number }>(
      (players as ScramblePlayerRow[]).map((p) => [p.id, { name: p.name, points: 0 }])
    );

    const processedRounds = (rounds as ScrambleRoundRow[]).map((r) => {
      const team1 = [r.p1_id, r.p2_id]
        .filter(Boolean)
        .map((id) => playerMap.get(id!) ?? "Unknown");
      const team2 = [r.p3_id, r.p4_id]
        .filter(Boolean)
        .map((id) => playerMap.get(id!) ?? "Unknown");

      let winner: "team1" | "team2" | "tie" = "tie";
      if (r.team1_score < r.team2_score) winner = "team1";
      else if (r.team2_score < r.team1_score) winner = "team2";

      if (winner === "team1") {
        [r.p1_id, r.p2_id].filter(Boolean).forEach((id) => {
          const entry = pointsMap.get(id!);
          if (entry) entry.points++;
        });
      } else if (winner === "team2") {
        [r.p3_id, r.p4_id].filter(Boolean).forEach((id) => {
          const entry = pointsMap.get(id!);
          if (entry) entry.points++;
        });
      }

      return {
        id: r.id,
        date: r.date,
        course: r.course,
        team1,
        team2,
        team1Score: r.team1_score,
        team2Score: r.team2_score,
        winner,
      };
    });

    const sortedPlayers = Array.from(pointsMap.entries())
      .map(([id, { name, points }]) => ({ id, name, points }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

    return NextResponse.json({ players: sortedPlayers, rounds: processedRounds });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
