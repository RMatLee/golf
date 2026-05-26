# app/courses — Course Library Page

Displays recently-played course cards and a full CRUD table of all courses.

## Data Source
On mount, fetches courses from Supabase `courses` table and rounds from `rounds` table (for stats/recent logic). No API route intermediary — reads directly from Supabase with the anon key (RLS allows public SELECT).

```ts
// Matches CourseRow in lib/types.ts
interface Course {
  id: string; name: string; city: string;
  par: number; rating: number; slope: number;
  image: string | null;   // Supabase Storage URL or slug string
}
interface Round { id: string; date: string; course_id: string; score: number; }
```

## State
- `courses` / `rounds` — fetched from Supabase on mount
- `search`, `modalOpen`, `editTarget: Course | null`, `deleteTarget: Course | null`

## Auth
```ts
const { session } = useAuth();
const isAdmin = session !== null;
```
Add/Edit/Delete buttons only render when `isAdmin`. All writes go directly to Supabase (authenticated user's token; RLS rejects unauthenticated writes).

## Key Logic
- `useCourseStats(courses, rounds)` — memoized; returns `{ course, timesPlayed, bestScore, lastPlayed }` per course
- `recentCourses` — 3 most recently played (deduped by courseId, iterating rounds sorted newest-first)
- `tableRows` — stats filtered by `search` matching name or city
- `isDuplicate(name)` — case-insensitive check against existing course names; prevents duplicate adds

## CRUD & Toasts
- **Add/Edit**: `CourseModal` — `editTarget=null` for add, `editTarget=Course` for edit. `handleSave` calls Supabase `insert` or `update`, then `toast.success` / `toast.error`.
- **Delete**: `DeleteConfirm` modal — `handleDelete` calls Supabase `delete`, then `toast.success` / `toast.error`.
- **Image upload**: On save with an image file, uploads to `course-images` bucket. Returns public URL stored in `image` column. Max 5 MB; accepted: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

## Image Rendering
```ts
function courseImageSrc(image: string | null): string | null {
  // Returns full URL if already a URL, otherwise null (no local slug fallback)
}
```
`<Image fill>` (Next.js) used in `CourseCard`. Upload previews use `<img src={URL.createObjectURL(file)}>`.

## CourseSearch Component
`components/CourseSearch.tsx` — unified search + name input used in `CourseModal`.
- Queries `GET /api/courses/search?q=` after 350ms debounce
- `skipNextSearchRef` (useRef) prevents the dropdown from re-opening after user selects a result
- If no API key configured or no results found, falls back to plain text entry
- `onSelect({ name, city })` — fills both name and city fields from a Places result

## Validation
All numeric fields (par, slope, rating) use `type="number"` with `min`/`max` and block `e`, `E`, `+`, `-` via `onKeyDown`. All text fields are `required`.

## CourseCard Component
`<Image fill>` card, 220px height, gradient overlay, hover scale + gold border shimmer. Shows rating/slope + par pills at bottom.
