import { NextRequest, NextResponse } from "next/server";

export interface CourseSearchResult {
  name:    string;
  city:    string;
  placeId: string;
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const q      = req.nextUrl.searchParams.get("q")?.trim();

  // No key configured — return empty so the UI degrades silently
  if (!apiKey) {
    return NextResponse.json({ results: [], configured: false });
  }

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], configured: true });
  }

  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", `${q} golf course`);
  url.searchParams.set("type", "golf_course");
  url.searchParams.set("key", apiKey);

  const res  = await fetch(url.toString());
  const data = await res.json();

  const results: CourseSearchResult[] = (data.results ?? []).slice(0, 5).map((place: any) => {
    // formatted_address: "N27W24025 Paul Ct, Pewaukee, WI 53072, USA"
    // We want: "Pewaukee, WI"
    const parts     = (place.formatted_address ?? "").split(",");
    const cityPart  = parts.length >= 3 ? parts[parts.length - 3]?.trim() : parts[0]?.trim();
    const statePart = parts.length >= 3 ? parts[parts.length - 2]?.trim().split(" ")[0] : "";
    const city      = statePart ? `${cityPart}, ${statePart}` : (cityPart ?? "");

    return { name: place.name, city, placeId: place.place_id };
  });

  return NextResponse.json({ results, configured: true });
}
