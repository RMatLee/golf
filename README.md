# Ryan's Golf Tracker

A personal golf round and stats tracker. Public-facing with admin-only data entry — anyone can view rounds, stats, and the equipment bag, but only the authenticated owner can log rounds, add courses, or manage clubs.

## Features

- **Dashboard** — stat strip (last score, course, handicap, rounds played) + 3 recent rounds preview
- **Round History** — sortable and filterable table of all logged rounds with vs-par badges
- **Performance Stats** — 4 Recharts line charts (score trend, score vs par, putts, handicap) with time-range filters
- **Course Library** — CRUD table with image upload, Google Places autocomplete, and duplicate prevention
- **Equipment Bag** — accordion by club type with image/video upload per club; dynamic section backgrounds
- **Scrambles** — team scramble leaderboard with podium visual (1st/2nd/3rd by points), full player rankings, match history, and admin-only match logging with inline new course creation
- **Log a Round** — multi-step form (auth-guarded) with optional new course creation inline
- **Admin Auth** — Supabase email/password sign-in; public read, authenticated writes

## E2E Call Flow

The [interactive E2E call diagram](./e2e-calls.html) traces public page reads through rate limiting, Redis, and Supabase, plus admin sign-in, data writes, course search, media uploads, round logging, and cache invalidation. Its editable [sequence specification](./e2e-calls.sequence.json) is also included.

Playwright E2E tests cover public navigation, the unauthenticated round-log redirect, and admin round logging (including nine-hole rounds, failed inserts/retry, and cache invalidation). The test fixtures intercept API and Supabase requests rather than contacting live services.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.5 |
| Runtime | React | 19 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | v4 |
| Animation | Framer Motion | ^12 |
| Charts | Recharts | ^3 |
| UI Primitives | shadcn/ui | ^4 |
| Database | Supabase (PostgreSQL) | ^2 |
| Auth | Supabase Auth | ^2 |
| Storage | Supabase Storage | ^2 |
| Cache | Upstash Redis | ^1 |
| Rate Limiting | Upstash Ratelimit | ^2 |
| Validation | Zod | (peer dep) |
| Toasts | Sonner | ^2 |
| Course Search | Google Places API (New), Text Search | — |

## Project Structure

```
golf/
├── app/
│   ├── layout.tsx              # Root layout: Navbar, Providers, ErrorBoundary, Toaster
│   ├── page.tsx                # Home — hero, stat strip, recent rounds
│   ├── rounds/
│   │   └── page.tsx            # Round history table with sort/filter
│   ├── stats/
│   │   └── page.tsx            # Performance charts
│   ├── courses/
│   │   └── page.tsx            # Course CRUD + image upload
│   ├── clubs/
│   │   └── page.tsx            # Equipment bag + media upload
│   ├── log-round/
│   │   └── page.tsx            # Multi-step round logging (auth-guarded)
│   ├── login/
│   │   └── page.tsx            # Email/password sign-in
│   ├── scrambles/
│   │   └── page.tsx            # Scramble leaderboard, match history, admin match logging
│   └── api/
│       ├── home/route.ts       # GET — stats strip + recent rounds (cached)
│       ├── rounds/route.ts     # GET — all rounds (cached)
│       ├── stats/route.ts      # GET — rounds with putts/handicap (cached)
│       ├── scrambles/route.ts  # GET — players (with points) + match history
│       ├── courses/
│       │   └── search/route.ts # GET — Google Places course autocomplete
│       └── cache/
│           └── invalidate/route.ts  # POST — clears all Redis cache keys
├── components/
│   ├── Navbar.tsx              # Floating pill navbar with auth-aware links
│   ├── CourseSearch.tsx        # Unified course name search + manual entry
│   ├── error-boundary.tsx      # Reusable React error boundary (class component)
│   ├── providers.tsx           # AuthProvider wrapper
│   └── ui/
│       └── button.tsx          # shadcn/ui Button primitive
├── lib/
│   ├── supabase.ts             # Supabase client (untyped)
│   ├── types.ts                # CourseRow, RoundRow, ClubRow, ClubType, ScramblePlayerRow, ScrambleRoundRow
│   ├── redis.ts                # Upstash Redis client, CACHE_KEYS, CACHE_TTL
│   ├── ratelimit.ts            # readLimiter, searchLimiter, mutateLimiter
│   ├── auth-context.tsx        # AuthProvider + useAuth() hook
│   ├── schemas.ts              # Zod schemas for all API shapes
│   └── utils.ts                # cn() — clsx + tailwind-merge
├── public/
│   ├── images/
│   │   ├── courses/            # Fallback course images ({slug}.jpg)
│   │   └── clubs/              # Default club section images
│   └── videos/
│       ├── golf-course.mp4     # Hero video
│       └── clubs/driver.mp4    # Default driver section video
├── .env.local                  # Secrets (gitignored — see .env.example)
├── .env.example                # Documents all required env vars (safe to commit)
├── next.config.ts              # remotePatterns for Supabase Storage images
└── package.json
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis auth token |
| `GOOGLE_PLACES_API_KEY` | No | Places API (New) server-side key; enables course search autocomplete |

## Google Places Setup (Optional)

1. In Google Cloud Console, select your project and link an active billing account.
2. Under **APIs & Services > Library**, enable **Places API (New)**.
3. Under **Credentials**, create or select an API key and restrict its API access to
   **Places API (New)**. Requests originate from the Next.js server, so do not use
   website/HTTP-referrer restrictions. IP restrictions require a stable server egress IP.
4. Set `GOOGLE_PLACES_API_KEY` in `.env.local` and restart the development server.
   For deployment, set the same variable in your hosting provider's environment
   settings for each environment you use, then redeploy. Never expose it as a
   `NEXT_PUBLIC_` variable.
5. Test `/api/courses/search?q=Pebble`. A working configuration returns
   `{ "results": [...], "configured": true }`. Course selection fills the name and city.

The server uses `POST https://places.googleapis.com/v1/places:searchText` and requests
only place IDs, display names, and formatted addresses, returning at most five suggestions.
This replaces Text Search (Legacy); enabling only Maps JavaScript API is not sufficient.
Display names require the Text Search Pro SKU; review Google Maps Platform pricing
and set appropriate quotas and billing alerts.

Without a key, course names can still be entered manually. Search also depends on
Upstash Redis for rate limiting. If Google rejects a request, inspect hosting logs
for `[/api/courses/search] Google Places error` and check billing and key restrictions.

## Supabase Setup

### Tables

**`courses`**
```sql
id       uuid primary key default gen_random_uuid()
name     text not null
city     text not null
par      integer not null
rating   numeric not null
slope    integer not null
image    text
```

**`clubs`**
```sql
id        uuid primary key default gen_random_uuid()
name      text not null
type      text not null
carry     text not null default '--'
loft      text not null default '--'
shaft     text not null default '--'
media_url text
```

**`rounds`**
```sql
id         uuid primary key default gen_random_uuid()
date       date not null
course_id  uuid references courses(id)
score      integer not null
par        integer not null
putts      integer not null default 0
handicap   numeric not null default 0
```

**`scramble_players`**
```sql
id         uuid primary key default gen_random_uuid()
name       text unique not null
created_at timestamptz default now()
```

**`scramble_rounds`**
```sql
id           uuid primary key default gen_random_uuid()
date         date not null
course       text not null
p1_id        uuid not null references scramble_players(id)
p2_id        uuid references scramble_players(id)
p3_id        uuid references scramble_players(id)
p4_id        uuid references scramble_players(id)
team1_score  integer not null
team2_score  integer not null
created_at   timestamptz default now()
```

### RLS Policies
Enable RLS on all tables, then run:

```sql
-- Public read
CREATE POLICY "public read" ON courses FOR SELECT USING (true);
CREATE POLICY "public read" ON clubs    FOR SELECT USING (true);
CREATE POLICY "public read" ON rounds   FOR SELECT USING (true);

-- Authenticated write
CREATE POLICY "auth write" ON courses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth write" ON clubs    FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth write" ON rounds   FOR ALL USING (auth.role() = 'authenticated');

-- Grant table-level permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rounds  TO anon, authenticated;

-- Scramble tables
ALTER TABLE scramble_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE scramble_rounds  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read scramble_players" ON scramble_players FOR SELECT TO public USING (true);
CREATE POLICY "authenticated write scramble_players" ON scramble_players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "public read scramble_rounds"  ON scramble_rounds  FOR SELECT TO public USING (true);
CREATE POLICY "authenticated write scramble_rounds"  ON scramble_rounds  FOR INSERT TO authenticated WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT          ON public.scramble_players TO anon, authenticated;
GRANT INSERT          ON public.scramble_players TO authenticated;
GRANT SELECT          ON public.scramble_rounds  TO anon, authenticated;
GRANT INSERT          ON public.scramble_rounds  TO authenticated;
```

### Storage Buckets
Create two **public** buckets in the Supabase Storage dashboard:
- `course-images` — course photos (5 MB max per file)
- `club-media` — club photos and videos (50 MB max per file)

### Admin User
Create a user in the Supabase Auth dashboard (Email/Password provider) with your email and a strong password.

## Local Development

```bash
npm install
npm run dev       # http://localhost:3000
```

## Production Build

```bash
npm run build
npm run start
```

## Tests and CI

Use Node.js 22 and run commands from the repository root (the directory containing
`package.json`).

```bash
npm ci
npm run lint
npm run typecheck
npm run test:unit       # Single Vitest run
npm run test:coverage   # Coverage reports and enforced thresholds
npm test               # Vitest watch mode
```

### Unit and component tests

[Vitest configuration](./vitest.config.mts) uses React Testing Library and jsdom,
with a Node environment for API/request tests. Tests live in
[tests/unit](./tests/unit). Supabase and Redis operations are mocked; no real
service credentials are required.

The focused baseline covers schema validation, class merging, rate-limit helpers,
auth initialization/events/sign-out/cleanup, and cache invalidation success,
rate-limit, and error responses. Course autocomplete also has component regression
tests for manual entry, debounce, selection, stale responses, and failures.

**The 80% coverage gate applies per file, separately to lines, statements,
functions, and branches, for these core modules only:**

- [lib/schemas.ts](./lib/schemas.ts)
- [lib/utils.ts](./lib/utils.ts)
- [lib/ratelimit.ts](./lib/ratelimit.ts)
- [lib/auth-context.tsx](./lib/auth-context.tsx)
- [app/api/cache/invalidate/route.ts](./app/api/cache/invalidate/route.ts)

This is not an 80% whole-app coverage claim. Expand `coverage.include` in the
Vitest configuration as additional modules gain tests. Reports are written to
`coverage/` (HTML, LCOV, and JSON summary).

### End-to-end tests

[Playwright configuration](./playwright.config.ts) runs Chromium against a
**production build** on `http://127.0.0.1:3100`. It starts and stops its own server;
keep that port free. Install Chromium once with `npx playwright install chromium`
(on Linux CI, use `npx playwright install --with-deps chromium`).

Build with placeholder public credentials, even when real values exist in
`.env.local`: Next.js embeds `NEXT_PUBLIC_*` values at build time. Example for
PowerShell:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "https://golf-test.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
$env:UPSTASH_REDIS_REST_URL = "https://redis.invalid"
$env:UPSTASH_REDIS_REST_TOKEN = "test-token"
$env:GOOGLE_PLACES_API_KEY = ""
npm run build
if ($LASTEXITCODE -eq 0) { npm run test:e2e }
```

Use a dedicated terminal for these overrides, then close it before normal app
development. Rebuild with your deployment environment before deploying; never
deploy this placeholder-credential build.

The tests exercise public navigation across all main pages, home data errors,
the unauthenticated login guard, failed/successful login, required round fields,
18-hole and front/back nine round payloads, cache invalidation, form reset, and
failed-save retry.

The automatic [backend fixture](./tests/e2e/fixtures.ts) intercepts app API,
Supabase auth/REST, and optional Places-search requests in the browser. Unexpected
API or external requests fail the test rather than reaching a real service.
These tests validate app behavior, **not** real Supabase RLS, Redis connectivity,
or Google Places integration.

```bash
npm run test:e2e:ui          # Interactive runner (requires the same test build)
npx playwright show-report # Open the last HTML report
```

Reports go to `playwright-report/`; failed tests retain traces and screenshots in
`test-results/`. Generated reports are gitignored.

### GitHub Actions

[CI workflow](./.github/workflows/ci.yml) runs on every pull request and push to
`main`, using Node.js 22 and `npm ci`. Two independent jobs run:

1. **Lint, types, and unit coverage**: full-app ESLint, Next route type generation
   plus TypeScript, and the gated Vitest coverage run.
2. **Production build and Chromium E2E**: browser installation, production build,
   and Playwright tests with two workers and up to two retries.

No GitHub secrets or live test accounts are needed. Coverage and Playwright
reports are uploaded as artifacts, including on failure when reports exist, with
14-day retention. Stale runs for the same PR/ref are cancelled. To prevent merging
when tests fail, configure the repository's branch protection/ruleset to require
both job checks; the workflow alone does not enforce merge protection.

## Deployment

The app is a standard Next.js application and can be deployed to any platform that supports it.

**Vercel (recommended):**
1. Push to GitHub
2. Import the repository in Vercel
3. Set the root directory to `golf/` if the repo root is the parent folder
4. Add all environment variables from `.env.local` in the Vercel project settings
5. Deploy
