# Golf Tracker — Project Root

Personal golf tracker app for Ryan Lee. Tracks rounds, stats, courses, and equipment. Public read, admin-only writes.

## Stack
- **Next.js 16.2.5** (App Router) — all routes under `app/`; API routes under `app/api/`
- **React 19** with TypeScript strict mode
- **Tailwind CSS v4** — utility classes only
- **Framer Motion 12** — all page/element animations
- **Recharts 3** — stats charts (`LineChart`, `ResponsiveContainer`)
- **shadcn/ui** — `components/ui/` primitives
- **Supabase** — PostgreSQL database + Storage buckets + Auth (email/password)
- **Upstash Redis** — read-through caching; TTL 86400s; invalidated on round writes
- **Upstash Ratelimit** — sliding window limits on all API routes
- **Zod** — request param validation + Supabase response shape validation
- **Sonner** — toast notifications (dark theme, bottom-right)
- **Google Places API** — course search autocomplete (optional; gracefully disabled if key absent)
- Path alias `@/` → project root (`golf/`)

## Commands
```bash
npm run dev      # dev server on localhost:3000
npm run build    # production build (TypeScript check + bundle)
npm run lint     # ESLint
```

## Environment Variables
All secrets live in `.env.local` (gitignored). See `.env.example` for the full list.
```
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon/public key
UPSTASH_REDIS_REST_URL          # Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN        # Upstash Redis REST token
GOOGLE_PLACES_API_KEY           # Google Places Text Search API key (optional)
```

## Design System
- Background: `#0a0a0a` (near-black)
- Gold accent: `#c9a84c` (hover: `#d4b86a`)
- Text muted: `text-white/40`, borders: `border-white/10`
- Fonts: Inter (`--font-sans`), Geist Sans (`--font-geist-sans`), Geist Mono

## Architecture

### Data Layer
All data is served through **Next.js API routes** (`app/api/`) — never fetched directly from the client to Supabase (except for auth-gated writes in courses/clubs/log-round, which use the Supabase client with the user's session token enforced by RLS).

```
Client → /api/home | /api/rounds | /api/stats   (cached reads, rate-limited)
Client → /api/courses/search                    (Google Places proxy, rate-limited)
Client → /api/cache/invalidate                  (POST, rate-limited; called after round insert)
Client → supabase (courses/clubs CRUD, round insert) — authenticated writes only, RLS enforced
```

### Caching Strategy
| Cache key       | Route          | Invalidated by            |
|-----------------|----------------|---------------------------|
| `home:stats`    | `/api/home`    | `POST /api/cache/invalidate` |
| `home:recent`   | `/api/home`    | `POST /api/cache/invalidate` |
| `rounds:all`    | `/api/rounds`  | `POST /api/cache/invalidate` |
| `stats:all`     | `/api/stats`   | `POST /api/cache/invalidate` |

Courses and clubs are **not cached** — their pages write directly to Supabase and re-fetch on mount.

### Authentication
- Single admin user via Supabase Auth (email/password)
- `AuthProvider` in `lib/auth-context.tsx` exposes `{ session, loading }` via `useAuth()` hook
- Wrapped at root in `components/providers.tsx`
- Public pages: read-only; authenticated pages: `/log-round` (guarded — redirects to `/login` if no session)
- Courses/clubs show Add/Edit/Delete controls only when `isAdmin` (`session !== null`)

### Supabase RLS Policy Pattern
Every table has:
- `SELECT` → `public` (anon and authenticated)
- `INSERT`, `UPDATE`, `DELETE` → `authenticated` role only

### Storage Buckets
| Bucket         | Purpose                     | Limit     |
|----------------|-----------------------------|-----------|
| `course-images`| Course photos               | 5 MB      |
| `club-media`   | Club photos and videos      | 50 MB     |

Both buckets are public. URLs are stored directly in the `image` column (courses) or `media_url` column (clubs).

### Error Boundaries
`components/error-boundary.tsx` — reusable class component (`ErrorBoundary`).
- Layout wraps all page content in `<ErrorBoundary section="Page">`
- Home page wraps stat strip and recent rounds sections separately
- Stats page wraps the entire charts section
- Fallback UI matches dark theme; includes "Try again" reset button

### Validation (Zod)
`lib/schemas.ts` — single source of truth for all data shapes:
- `courseSearchQuerySchema` — validates `q` query param on `/api/courses/search`
- `roundItemSchema`, `statRoundSchema`, `recentRoundSchema`, `homeStatsSchema` — validate Supabase rows **after mapping**, before caching or returning

## Routes
| Path | File | Purpose |
|------|------|---------|
| `/` | `app/page.tsx` | Hero + stat strip + recent rounds preview |
| `/rounds` | `app/rounds/page.tsx` | Sortable/filterable rounds history |
| `/stats` | `app/stats/page.tsx` | Recharts performance charts |
| `/courses` | `app/courses/page.tsx` | Course library with CRUD + image upload |
| `/clubs` | `app/clubs/page.tsx` | Equipment bag with media upload |
| `/log-round` | `app/log-round/page.tsx` | Multi-step round logging (auth-guarded) |
| `/login` | `app/login/page.tsx` | Email/password sign-in |

## Shared Lib (`lib/`)
| File | Purpose |
|------|---------|
| `supabase.ts` | Untyped Supabase client (no `<Database>` generic — avoids `never` type errors) |
| `types.ts` | `CourseRow`, `RoundRow`, `ClubRow`, `Database`, `ClubType` |
| `redis.ts` | Redis client, `CACHE_KEYS`, `CACHE_TTL` |
| `ratelimit.ts` | `readLimiter`, `searchLimiter`, `mutateLimiter`; `getIP()`; `rateLimitResponse()` |
| `auth-context.tsx` | `AuthProvider`, `useAuth()` hook |
| `schemas.ts` | Zod schemas for all API request/response shapes |
| `utils.ts` | `cn()` — clsx + tailwind-merge utility |

## Key Shared Patterns
- `toImageSlug(name)` — lowercase, spaces→hyphens, strips non-alphanumeric; used for image filename hints
- `fmtDate(iso)` — `toLocaleDateString("en-US", { month, day, year })` — used in rounds/home
- `toPar(score, par)` → `{ label, color }` — scoring label helper in rounds/log-round
- All form submit handlers use `React.SyntheticEvent<HTMLFormElement>` (not `React.FormEvent`)
- `<Image>` (Next.js) used for all persistent images; `<img>` used only for blob: URL upload previews
- Supabase join results typed with `(r: any)` in map callbacks — join shape not inferred by untyped client
