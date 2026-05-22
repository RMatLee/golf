# Golf Tracker — Project Root

Personal golf tracker app for Ryan Lee. Tracks rounds, stats, courses, and equipment.

## Stack
- **Next.js 15** (App Router) — read `node_modules/next/dist/docs/` before writing Next.js code; this version has breaking changes from training data
- **TypeScript** strict mode
- **Tailwind CSS v4** — utility classes only, no config file edits needed for common use
- **Framer Motion** — all page/element animations
- **Recharts** — stats charts (LineChart, ResponsiveContainer)
- **shadcn/ui** — `components/ui/` primitives (button, etc.)
- Path alias `@/` → project root

## Commands
```bash
npm run dev      # dev server on localhost:3000
npm run build    # production build
npm run lint     # ESLint
```

## Design System
- Background: `#0a0a0a` (near-black)
- Gold accent: `#c9a84c` (hover: `#d4b86a`)
- Text muted: `text-white/40`, borders: `border-white/10`
- Fonts: Inter (`--font-sans`), Geist Sans (`--font-geist-sans`), Geist Mono

## Architecture
All data is **in-memory React state** seeded from hardcoded `SEED_*` arrays — no backend, no database, no persistence across page refreshes. All page components are `"use client"`.

### Routes
| Path | File | Purpose |
|------|------|---------|
| `/` | `app/page.tsx` | Hero + stat strip + recent rounds preview |
| `/rounds` | `app/rounds/page.tsx` | Sortable/filterable rounds history |
| `/stats` | `app/stats/page.tsx` | Recharts performance charts |
| `/courses` | `app/courses/page.tsx` | Course library with CRUD |
| `/clubs` | `app/clubs/page.tsx` | Equipment bag with accordion sections |
| `/log-round` | `app/log-round/page.tsx` | 2-step round logging form |

### Shared Layout
`app/layout.tsx` wraps every route with `<Navbar />` inside a dark `min-h-full flex flex-col` body.

### Static Assets
- Course images: `public/images/courses/{slug}.jpg` — slug from `toImageSlug(name)`
- Club images: `public/images/clubs/{type}.jpg` or `.jpeg`
- Club video: `public/videos/clubs/driver.mp4`
- Hero video: `public/videos/golf-course.mp4`

## Key Shared Patterns
- `toImageSlug(name)` — lowercased, spaces→hyphens, strips non-alphanumeric: used in courses and log-round
- `uid()` — `Math.random().toString(36).slice(2,9)` — local ID generation
- `fmtDate(iso)` — `toLocaleDateString("en-US", { month, day, year })` — appears in multiple pages
- `toPar(score, par)` → `{ label, color }` — scoring label helper, duplicated in rounds/log-round
