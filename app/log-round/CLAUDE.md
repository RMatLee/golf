# app/log-round — Round Logging Form

Auth-guarded multi-step wizard: Step 0 (Round Details) → Step 1 (Course) → Step 2 (Success).
Redirects unauthenticated users to `/login` via `useEffect`.

## Auth Guard
```ts
const { session, loading: authLoading } = useAuth();
useEffect(() => {
  if (!authLoading && !session) router.replace("/login");
}, [authLoading, session, router]);
if (authLoading || !session) return null;
```

## State
```ts
step: 0 | 1 | 2
roundForm: { date: string; score: string; putts: string }
selectedId: string          // course id, or "new" for a brand-new course
newCourse: { name: string; city: string; par: string; rating: string; slope: string }
imageFile: File | null      // optional image for new course
submitting: boolean
savedCourse: Course | null  // set on success for StepSuccess display
courses: Course[]           // fetched from Supabase on mount
```

## Data Source
On mount, fetches courses from Supabase: `supabase.from("courses").select("*").order("name")`.

## Submit Flow (`handleSubmit`)
Wrapped in try/catch; `toast.error` on any failure.

1. If `selectedId === "new"`:
   - Upload image to `course-images` bucket if `imageFile` present (max 5 MB); store public URL
   - Insert into `courses` table: `{ name, city, par, rating, slope, image }`
   - Append new course to local `courses` state; update `courseId`
2. Insert into `rounds` table: `{ date, course_id, score, par, putts }`
3. Call `POST /api/cache/invalidate` to clear Redis cache keys (`home:stats`, `home:recent`, `rounds:all`, `stats:all`)
4. Advance to `step = 2` (success screen)

## Data Shapes
```ts
interface RoundForm    { date: string; score: string; putts: string; }
interface NewCourseForm { name: string; city: string; par: string; rating: string; slope: string; }
```
All numeric values are strings in state; converted with `Number()` at insert time.

## Step Components
- `StepBar` — 2-step progress indicator (step 3/success not shown in bar)
- `Field` — label + optional hint wrapper
- `StepRoundDetails` — date, score (30–200), putts (10–80)
- `StepCourse` — course select dropdown or `"new"` reveals `NewCourseForm` with `CourseSearch` + image upload
- `StepSuccess` — score/par/putts summary with "Log Another" and "Back to Home" actions
- Steps transition with `x: 24 → 0` slide-in / `x: -24` slide-out via `AnimatePresence mode="wait"`

## Validation
- Score: `type="number" min={30} max={200} required`
- Putts: `type="number" min={10} max={80} required`
- New course numeric fields block `e`, `E`, `+`, `-` via `onKeyDown`
- New course submit guard: all fields must be non-empty before calling `onSubmit()`

## Constants
- `TODAY = new Date().toISOString().split("T")[0]` — default date value
- `MAX_FILE_SIZE = 5 * 1024 * 1024` — 5 MB image limit
- `ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]`
