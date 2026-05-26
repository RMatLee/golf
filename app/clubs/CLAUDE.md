# app/clubs — Equipment Bag Page

Accordion of club sections (one open at a time), each with a dynamic media background and CRUD club list.

## Data Source
On mount, fetches all clubs from Supabase `clubs` table. No API route intermediary — reads directly with anon key (RLS allows public SELECT).

```ts
// Matches ClubRow in lib/types.ts
type ClubType = "Driver" | "Fairway Woods" | "Hybrids" | "Irons" | "Wedges" | "Putter"
interface Club {
  id: string; name: string; type: ClubType;
  carry: string; loft: string; shaft: string;
  media_url: string | null;  // Supabase Storage URL (image or video)
}
```
`carry` and `loft` are strings (user input), not numbers. `carry = "--"` for putter.

## Auth
```ts
const { session } = useAuth();
const isAdmin = session !== null;
```
Add/Edit/Delete buttons only render when `isAdmin`. All writes go to Supabase (RLS rejects unauthenticated writes).

## Section Config (`CLUB_SECTIONS`)
Static config array with `type`, `label`, `subtitle`, and default `media` (fallback when no club has media):
- Driver: `{ kind: "video", src: "/videos/clubs/driver.mp4" }`
- Others: `{ kind: "image", src: "/images/clubs/{slug}.jpg" }`

## Dynamic Backgrounds
`lastClubMedia(clubs, type)` — finds the last-inserted club of a given type that has a `media_url`. Returns `{ kind: "image"|"video", src: url }` or `null`.

`SectionBackground` accepts an `override: DynamicMedia | null` prop. If override is present, it renders the club's uploaded media; otherwise falls back to the static section default.

`isVideoUrl(url)` — returns `true` if the URL ends with `.mp4`, `.mov`, `.webm`, or `.ogg`.

## State
- `clubs` — all clubs from Supabase
- `openSection: ClubType | null` — one section expanded at a time
- `modalOpen`, `editTarget: Club | null`, `addingToType: ClubType | null`

## CRUD & Toasts
- `handleSave(data, id?)` — Supabase `insert` (new) or `update` (edit), then `toast.success` / `toast.error`
- `handleDelete(id)` — Supabase `delete`, then `toast.success` / `toast.error`

## Media Upload (ClubModal)
User can attach either an image or video when adding/editing a club:
- **Images**: `image/jpeg`, `image/png`, `image/webp`, `image/gif` — max 5 MB
- **Videos**: `video/mp4`, `video/quicktime`, `video/webm` — max 50 MB
- Uploaded to `club-media` Supabase Storage bucket; public URL stored in `media_url` column
- Upload previews use `<img>` / `<video>` with `URL.createObjectURL()` (not Next.js `<Image>` — blob: URLs not supported)

## Components
- `SectionCard` — accordion card; header height 100px (closed) / 180px (open)
- `SectionBackground` — renders `<video autoPlay muted loop>` or `<img>` with brightness filter (0.3 closed, 0.45 open)
- `ClubRow` — single club line with carry/loft/shaft details; hover shows edit/delete buttons (admin only)
- `ClubModal` — add/edit form: name, type select, carry, loft, shaft-flex select, media upload

## Shaft Options
`["Extra Stiff", "Stiff", "Regular", "Senior", "Ladies", "Steel", "Graphite"]`
