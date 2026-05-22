# app/log-round — Round Logging Form

Multi-step wizard: Step 0 (Round Details) → Step 1 (Course) → Step 2 (Success).

## State
```
step: 0 | 1 | 2
roundForm: RoundForm   { date, score, putts }   — all strings except date (ISO)
selectedId: string     — course id, or "new" for a new course
newCourse: NewCourseForm  { name, city, par, rating, slope }  — all strings
courses: Course[]      — starts from SEED_COURSES; new courses appended on submit
```

## Data Shapes
```ts
interface Course { id: string; name: string; city: string; par: number; rating: number; slope: number; }
interface RoundForm { date: string; score: string; putts: string; }
interface NewCourseForm { name: string; city: string; par: string; rating: string; slope: string; }
```

## Step Flow
**Step 0** — date, score (30-200), putts (10-80). Submits → advances to step 1.

**Step 1** — select from `courses` dropdown or choose `"new"` to reveal `NewCourseForm` fields. Image-naming hint shown when `newCourse.name` is set: `{toImageSlug(name)}.jpg` → `public/images/courses/`.

**Step 2** — success screen. If `selectedId === "new"`, the new course is appended to `courses` state. `onLogAnother` resets all state to defaults. `onHome` calls `router.push("/")`.

## resolvedCourse
Derived (not memoized) on render:
- `selectedId === "new"` → build `Course` from `newCourse` fields (defaults: par=72, slope=113)
- otherwise → `courses.find(c => c.id === selectedId) ?? null`

## Components
- `StepBar` — 2-step progress indicator (step 3 not shown in bar)
- `Field` — label + optional hint wrapper
- `StepRoundDetails`, `StepCourse`, `StepSuccess` — each is an animated `motion.form` or `motion.div`
- Steps transition with `x: 24 → 0` slide-in / `x: -24` slide-out via `AnimatePresence mode="wait"`

## Constants
- `inputCls`, `selectCls` — shared Tailwind input/select class strings
- `TODAY = new Date().toISOString().split("T")[0]` — default date field value
- `SEED_COURSES` — 5 Milwaukee-area courses (same set as courses page, but independent copy)
