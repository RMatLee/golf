# app/ — Next.js App Router

All routes live here as `page.tsx` files. Every page is `"use client"`.

## Layout (`layout.tsx`)
Applies to all routes. Sets up fonts (Inter, Geist), imports `globals.css`, renders `<Navbar />` above `{children}` inside an `<ErrorBoundary section="Page">`. Includes `<Toaster>` (Sonner) for toast notifications. All wrapped in `<Providers>` which provides the `AuthContext`.

## Route → Component map
```
/            → app/page.tsx            Home (hero video, stat strip, recent rounds)
/rounds      → app/rounds/page.tsx     Round history (sort + filter)
/stats       → app/stats/page.tsx      Performance charts (Recharts)
/courses     → app/courses/page.tsx    Course library (CRUD + image upload)
/clubs       → app/clubs/page.tsx      Equipment bag (accordion + media upload)
/scrambles   → app/scrambles/page.tsx  Scramble leaderboard, match history, admin match logging
/log-round   → app/log-round/page.tsx  Multi-step round logging (auth-guarded)
/login       → app/login/page.tsx      Email/password sign-in
```

## API Routes (`app/api/`)
All API routes follow the same pattern: rate limit → cache check → Supabase fetch → Zod validate → cache write → return.

| Route | Method | Rate limiter | Purpose |
|-------|--------|--------------|---------|
| `/api/home` | GET | `readLimiter` | Stats strip + 3 recent rounds |
| `/api/rounds` | GET | `readLimiter` | All rounds for history page |
| `/api/stats` | GET | `readLimiter` | All rounds with putts/handicap for charts |
| `/api/scrambles` | GET | `readLimiter` | Scramble players (with points) + match history |
| `/api/courses/search` | GET | `searchLimiter` | Google Places course autocomplete |
| `/api/cache/invalidate` | POST | `mutateLimiter` | Deletes all 4 Redis cache keys |

## Page Layout Convention
All content pages use `max-w-[2xl|3xl|5xl] mx-auto px-5 pt-28 pb-24`. The `pt-28` clears the fixed Navbar (`top-6` + pill height).

## Data Flow
Pages fetch from API routes via `useEffect` on mount. Loading states show skeleton/pulse placeholders. Error states show inline red messages. No direct Supabase reads from page components except:
- `courses/page.tsx` and `clubs/page.tsx` — fetch their lists directly from Supabase on mount
- `log-round/page.tsx` — fetches course list from Supabase; inserts rounds and courses directly to Supabase (auth-gated by RLS)
- `scrambles/page.tsx` — reads via `/api/scrambles`; writes players/rounds directly to Supabase when admin logs a match (auth-gated by RLS)

## Auth Pattern
```ts
const { session, loading } = useAuth();
const isAdmin = session !== null;
```
Admin-only UI elements (Add/Edit/Delete buttons) are conditionally rendered with `isAdmin`. The log-round page redirects to `/login` if `!session` after auth loads.
