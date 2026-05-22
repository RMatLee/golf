# app/clubs — Equipment Bag Page

Accordion of club sections (one open at a time), each with a media background and CRUD club list.

## Data Shape
```ts
type ClubType = "Driver" | "Fairway Woods" | "Hybrids" | "Irons" | "Wedges" | "Putter"
interface Club { id: string; name: string; type: ClubType; carry: string; loft: string; shaft: string; }
```
`carry` and `loft` are strings (user input), not numbers. `carry = "--"` for putter.

## Section Config (`CLUB_SECTIONS`)
Each section has `type`, `media`, `label`, `subtitle`. Media is either `{ kind: "video", src }` or `{ kind: "image", src }`.
- Driver: `/videos/clubs/driver.mp4`
- Others: `/images/clubs/{type-slug}.jpg` (woods, hybrids, irons, wedges, putter)

## State
- `clubs` — all clubs; SEED has 13
- `openSection: ClubType | null` — only one section expanded at a time (`toggleSection` closes if same type clicked again)
- `modalOpen`, `editTarget`, `addingToType`

## CRUD Flow
- `openAdd(type)` → clears `editTarget`, sets `addingToType`, opens modal
- `openEdit(club)` → sets `editTarget` + `addingToType` to club's type, opens modal
- `handleSave(data, id?)` → upsert by id
- `handleDelete(id)` → filter out

## Components
- `SectionCard` — accordion card; header is a clickable 100px/180px media background. Shows club count when closed, "+ Add" button when open.
- `SectionBackground` — renders `<video>` or `<img>` with brightness filter (0.3 closed, 0.45 open)
- `ClubRow` — single club line with carry/loft/shaft details and hover edit/delete buttons
- `ClubModal` — add/edit form with name, type select, carry, loft, shaft-flex select

## Shaft Options
`["Extra Stiff", "Stiff", "Regular", "Senior", "Ladies", "Steel", "Graphite"]`
