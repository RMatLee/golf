# app/courses — Course Library Page

Displays recently-played course cards and a full CRUD table of all courses.

## Data Shapes
```ts
interface Course { id: string; name: string; city: string; par: number; rating: number; slope: number; image: string; }
interface Round  { id: string; date: string; courseId: string; score: number; }
```
`image` is a slug string (e.g. `"whitnall-park"`). Image file: `public/images/courses/{image}.jpg`.

`SEED_COURSES` — 5 Milwaukee-area courses. `SEED_ROUNDS` — 20 rounds (read-only in this page).

## State
- `courses` — mutable; add/edit/delete via modal
- `rounds` — read-only seed; used only for deriving stats and recently-played order
- `search`, `modalOpen`, `editTarget`, `deleteTarget`

## Key Logic
- `useCourseStats(courses, rounds)` — memoized, returns `{ course, timesPlayed, bestScore, lastPlayed }` per course
- `recentCourses` — 3 most recently played (deduped by courseId, iterating rounds sorted newest-first)
- `tableRows` — `stats` filtered by `search` matching name or city

## CRUD
- **Add/Edit**: `CourseModal` — controlled form, `editTarget=null` for add, `editTarget=Course` for edit. On save calls `handleSave(data, id?)`.
- **Delete**: `DeleteConfirm` — separate modal overlay. Past rounds are not affected.
- `toImageSlug(name)` → image filename hint shown in the add-course modal

## CourseCard Component
Image card with gradient overlay, 220px height, hover scale + gold shimmer. Shows rating/slope + par pills at bottom.
