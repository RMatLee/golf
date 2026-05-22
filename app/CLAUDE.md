# app/ — Next.js App Router

All routes live here as `page.tsx` files. Every page is `"use client"`.

## Layout (`layout.tsx`)
Applies to all routes. Sets up fonts (Inter, Geist), imports `globals.css`, renders `<Navbar />` above `{children}`. Body is `min-h-full flex flex-col bg` — pages set their own `min-h-screen bg-[#0a0a0a]`.

## Route → Component map
```
/            → app/page.tsx          Home (hero video, stat strip, recent rounds preview)
/rounds      → app/rounds/page.tsx   Round history (sort + filter)
/stats       → app/stats/page.tsx    Performance charts
/courses     → app/courses/page.tsx  Course library (CRUD)
/clubs       → app/clubs/page.tsx    Equipment bag (accordion)
/log-round   → app/log-round/page.tsx  Multi-step round logging form
```

## Page layout convention
All content pages use `max-w-[2xl|3xl|5xl] mx-auto px-5 pt-28 pb-24`. The `pt-28` clears the fixed Navbar (which is `top-6` + pill height).

## Data
No shared data layer. Each page maintains its own `useState` initialized from a local `SEED_*` constant. Changes don't persist across navigation.
