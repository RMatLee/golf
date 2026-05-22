# app/rounds — Round History Page

Displays the 3 most recent rounds as cards and all rounds in a sortable/filterable table.

## Data Shape
```ts
interface Round { id: string; date: string; course: string; score: number; par: number; }
```
`SEED_ROUNDS` — 21 hardcoded rounds, dates 2024-03 through 2026-05.

## State
| State | Type | Purpose |
|-------|------|---------|
| `search` | `string` | Filters table rows by course name (case-insensitive) |
| `course` | `string` | Dropdown filter; `"All"` or a course name |
| `sort` | `SortKey` | Controls table sort order |

`SortKey = "date-desc" | "date-asc" | "score-asc" | "score-desc"`

## Derived Data (useMemo)
- `byDateDesc` — all rounds sorted newest-first; `recentThree = byDateDesc.slice(0, 3)`
- `courses` — unique sorted course names prefixed with `"All"` for the dropdown
- `tableRounds` — filtered by `search` + `course`, then sorted by `sort`

## Components
- `RecentCard` — animated card (Framer Motion `initial/animate`), shows date, course, score, vs-par badge
- Table rows — `AnimatePresence mode="popLayout"`, each row uses `motion.div layout`

## Helpers
- `fmtDate(iso)` → `"Mar 2, 2024"` format
- `toPar(score, par)` → `{ label, color }` — e.g. `"+5"` in red, `"-2"` in emerald
- `toParBadgeBg(diff)` → Tailwind bg+text classes for the badge (emerald ≤0, yellow ≤10, red >10)
