import { NextRequest, NextResponse } from "next/server";
import { searchLimiter, getIP, rateLimitResponse } from "@/lib/ratelimit";
import { courseSearchQuerySchema } from "@/lib/schemas";

export interface CourseSearchResult {
  name:    string;
  city:    string;
  placeId: string;
}

export async function GET(req: NextRequest) {
  try {
    // ── Rate limit ─────────────────────────────────────────────────────────
    const { success, limit, reset, remaining } = await searchLimiter.limit(getIP(req));
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        rateLimitResponse(reset, limit, remaining),
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ results: [], configured: false });
    }

    const queryResult = courseSearchQuerySchema.safeParse({
      q: req.nextUrl.searchParams.get("q") ?? "",
    });
    if (!queryResult.success) {
      return NextResponse.json({ results: [], configured: true });
    }
    const { q } = queryResult.data;

    const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    url.searchParams.set("query", `${q} golf course`);
    url.searchParams.set("type", "golf_course");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());

    if (!res.ok) {
      console.error("[/api/courses/search] Google Places error:", res.status, res.statusText);
      return NextResponse.json({ error: "Search service unavailable" }, { status: 502 });
    }

    const data = await res.json();

    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[/api/courses/search] Google Places API status:", data.status);
      return NextResponse.json({ error: "Search service error", results: [], configured: true }, { status: 502 });
    }

    const results: CourseSearchResult[] = (data.results ?? []).slice(0, 5).map((place: any) => {
      const parts     = (place.formatted_address ?? "").split(",");
      const cityPart  = parts.length >= 3 ? parts[parts.length - 3]?.trim() : parts[0]?.trim();
      const statePart = parts.length >= 3 ? parts[parts.length - 2]?.trim().split(" ")[0] : "";
      const city      = statePart ? `${cityPart}, ${statePart}` : (cityPart ?? "");
      return { name: place.name, city, placeId: place.place_id };
    });

    return NextResponse.json({ results, configured: true });
  } catch (err) {
    console.error("[/api/courses/search] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
