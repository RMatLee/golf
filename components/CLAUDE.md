# components/

## Navbar (`Navbar.tsx`)
Floating pill nav bar. Fixed `top-6 left-1/2 -translate-x-1/2 z-50`. Fades in on mount with `y: -20 → 0` animation. Auth-aware: shows "Sign Out" button when session is active, "Sign In" link when signed out.

### Active link indicator
Uses `usePathname()` to detect current route. The active non-CTA link shows a `motion.span` with `layoutId="pill-indicator"` — Framer Motion animates it between links with a spring transition.

### Log Round CTA
Styled as `bg-[#c9a84c] text-black` pill. Only visible when user is authenticated (`session !== null`).

### Nav links
```ts
[Home /, Rounds /rounds, Stats /stats, Courses /courses, Clubs /clubs, Log Round /log-round]
```

## ErrorBoundary (`error-boundary.tsx`)
Reusable React class component (class components required for error boundaries).

```ts
<ErrorBoundary section="Charts">        // optional label shown in fallback UI
  <ComponentThatMightCrash />
</ErrorBoundary>
```

- `getDerivedStateFromError` — catches render errors, sets `hasError: true`
- `componentDidCatch` — logs error + component stack to console
- `reset()` — resets state so children are attempted again ("Try again" button)
- `fallback` prop — optional custom fallback node; if omitted, renders a styled dark card
- Used in: `app/layout.tsx` (page-level), `app/page.tsx` (stat strip + recent rounds), `app/stats/page.tsx` (charts section)

## CourseSearch (`CourseSearch.tsx`)
Unified search + manual entry input for course names. Used in `CourseModal` (courses page) and `StepCourse` (log-round page).

- Queries `GET /api/courses/search?q=` after 350ms debounce (min 2 chars)
- `skipNextSearchRef` (useRef boolean) — prevents the dropdown from re-appearing after the user clicks a suggestion. Set to `true` in `onMouseDown` on each suggestion; `useEffect` skips the search when it fires.
- If `configured: false` in response (no API key) — hides dropdown, acts as plain text input
- `onSelect({ name, city })` — parent callback to fill both name and city fields
- Props: `value`, `onChange`, `onSelect`, `required`

## Providers (`providers.tsx`)
Thin wrapper that applies `<AuthProvider>` from `lib/auth-context.tsx` to the component tree.

## ui/ (shadcn/ui primitives)
- `ui/button.tsx` — standard shadcn Button. Used sparingly; most buttons in this project are inline Tailwind `<button>` elements.
