# components/

## Navbar (`Navbar.tsx`)
Floating pill nav bar. Fixed `top-6 left-1/2 -translate-x-1/2 z-50`. Fades in on mount with a `y: -20 → 0` animation.

### Active link indicator
Uses `usePathname()` to detect current route. The active non-CTA link shows a `motion.span` with `layoutId="pill-indicator"` — Framer Motion animates it between links with a spring transition.

### Log Round CTA
The "Log Round" link is styled differently: `bg-[#c9a84c] text-black` pill, no indicator span, `ml-2` separation from other links.

### Nav links
```ts
[Home /, Rounds /rounds, Stats /stats, Courses /courses, Clubs /clubs, Log Round /log-round]
```

## ui/ (shadcn/ui primitives)
- `ui/button.tsx` — standard shadcn Button component. Used sparingly; most buttons in this project are inline Tailwind `<button>` elements, not this component.
