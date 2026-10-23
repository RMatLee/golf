/**
 * GET /api/courses/search?q=<query>
 *
 * Proxies a Google Places Text Search (New) request for golf courses and returns up to
 * 5 formatted results. The API key is kept server-side to avoid exposure in the browser.
 *
 * When `GOOGLE_PLACES_API_KEY` is not configured, returns `{ results: [], configured: false }`
 * so the `CourseSearch` component can fall back to plain text entry without any UI error.
 *
 * Response shape: { results: CourseSearchResult[], configured: boolean }
 *
 * City parsing: extracts the city+state abbreviation from Google's `formattedAddress`
 * string (comma-delimited, e.g. "Pebble Beach, CA 93953, USA").
 */
import { NextRequest, NextResponse } from "next/server";
import { searchLimiter, getIP, rateLimitResponse } from "@/lib/ratelimit";
import { courseSearchQuerySchema, googlePlacesResponseSchema } from "@/lib/schemas";

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

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
      },
      body: JSON.stringify({
        textQuery: `${q} golf course`,
        includedType: "golf_course",
        pageSize: 5,
      }),
    });

    if (!res.ok) {
      console.error("[/api/courses/search] Google Places error:", res.status, res.statusText);
      return NextResponse.json({ error: "Search service unavailable" }, { status: 502 });
    }

    const data = googlePlacesResponseSchema.safeParse(await res.json());
    if (!data.success) {
      console.error("[/api/courses/search] Invalid Google Places response:", data.error);
      return NextResponse.json({ error: "Search service error", results: [], configured: true }, { status: 502 });
    }

    const results: CourseSearchResult[] = data.data.places.slice(0, 5).map((place) => {
      const parts     = (place.formattedAddress ?? "").split(",");
      const cityPart  = parts.length >= 3 ? parts[parts.length - 3]?.trim() : parts[0]?.trim();
      const statePart = parts.length >= 3 ? parts[parts.length - 2]?.trim().split(" ")[0] : "";
      const city      = statePart ? `${cityPart}, ${statePart}` : (cityPart ?? "");
      return { name: place.displayName.text, city, placeId: place.id };
    });

    return NextResponse.json({ results, configured: true });
  } catch (err) {
    console.error("[/api/courses/search] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
