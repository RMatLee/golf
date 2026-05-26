# app/rounds — Round History Page

Displays the 3 most recent rounds as cards and all rounds in a sortable/filterable table.

## Data Source
Fetches from `GET /api/rounds` on mount. API route reads from Redis cache (`rounds:all`) or Supabase `rounds` table joined with `courses(name)`. Response shape validated by `roundItemSchema` (Zod).

```ts
// RoundItem — matches z.infer<typeof roundItemSchema>
interface RoundItem { id: string; date: string; course: string; score: number; par: number; }
```

## State
| State | Type | Purpose |
|-------|------|---------|
| `rounds` | `RoundItem[]` | All rounds from API |
| `loading` | `boolean` | Shows skeleton while fetching |
| `error` | `boolean` | Shows error message in table area |
| `search` | `string` | Filters table rows by course name (case-insensitive) |
| `course` | `string` | Dropdown filter; `"All"` or a course name |
| `sort` | `SortKey` | Controls table sort order |

`SortKey = "date-desc" | "date-asc" | "score-asc" | "score-desc"`

## Derived Data (useMemo)
- `byDateDesc` — all rounds sorted newest-first; `recentThree = byDateDesc.slice(0, 3)`
- `courses` — unique sorted course names prefixed with `"All"` for the dropdown
- `tableRounds` — filtered by `search` + `course`, then sorted by `sort`

## Components
- `RecentCard` — animated card (Framer Motion), shows date, course, score, vs-par badge
- Table rows — `AnimatePresence mode="popLayout"`, each row uses `motion.div layout`

## Helpers
- `fmtDate(iso)` → `"Mar 2, 2024"` format
- `toPar(score, par)` → `{ label, color }` — e.g. `"+5"` in red, `"-2"` in emerald
- `toParBadgeBg(diff)` → Tailwind bg+text classes for the badge (emerald ≤0, yellow ≤10, red >10)
