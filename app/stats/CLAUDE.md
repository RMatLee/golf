# app/stats — Performance Charts Page

Shows stat summary cards and 4 Recharts line charts with a time-range filter.

## Data Source
Fetches from `GET /api/stats` on mount. API route reads from Redis cache (`stats:all`) or Supabase `rounds` table joined with `courses(name)`, ordered ascending by date. Response shape validated by `statRoundSchema` (Zod).

```ts
// StatRound — matches z.infer<typeof statRoundSchema>
interface StatRound { id: string; date: string; course: string; score: number; par: number; putts: number; handicap: number; }
```

## Filter System
`RoundFilter = "last5" | "last10" | "last20" | "30d" | "90d" | "thisYear"`

`applyFilter(rounds, filter)` — returns a time-sorted subset. Date-based filters use `Date.now()` at render time.

## Derived Stats (useMemo)
From the filtered set: `avgScore`, `bestScore`, `avgPutts`, `bestPutts`, `latestHcp`, `hcpChange` (first→last in period).

## Charts
All use `ResponsiveContainer width="100%" height={220}` with `LineChart`. Wrapped in `<ErrorBoundary section="Charts">` — if Recharts crashes on malformed data, the stat cards above still render.

| Chart | dataKey | Color |
|-------|---------|-------|
| Score Trend | `score` | `#c9a84c` (gold) |
| Score vs Par | `toPar` (score−par) | `#7dd3a8` (mint) |
| Putts Per Round | `putts` | `#a78bfa` (purple) |
| Handicap Trend | `handicap` | `#c9a84c` (gold) |

Score Trend includes a `ReferenceLine y={avgScoreNum}` dashed gold average line.
Score vs Par includes a `ReferenceLine y={0}` as the even-par baseline.
Putts includes a `ReferenceLine y={30}` as target reference.

## Components
- `StatCard` — grid card with optional `highlight` prop (gold border/bg)
- `ChartCard` — wrapper with title/subtitle header
- `ChartTooltip` — custom Recharts tooltip; accepts `unit` and `prefix` props

## Error Handling
- API error → `error` state shows red italic message above charts; charts hidden
- Loading → `loading` state shows count as "Loading…" in subtitle; charts hidden
- Recharts render crash → `ErrorBoundary` catches and shows fallback card with "Try again"
