# Coach Dashboard V2 — Deliverable

Tablet-first Coach Dashboard for RealScouting Academy (Football Intelligence).

## Screenshots

| Viewport | File |
| --- | --- |
| iPad landscape 1194×834 (dashboard) | `ipad-landscape-dashboard.png` |
| iPad landscape (hero) | `ipad-landscape-dashboard-hero.png` |
| iPad portrait 834×1194 (dashboard) | `ipad-portrait-dashboard.png` |
| Auth gate landscape (dark) | `ipad-landscape-coach-auth-gate-dark.png` |
| Auth gate portrait (dark) | `ipad-portrait-coach-auth-gate-dark.png` |

## Dependencies installed

- `class-variance-authority`, `clsx`, `tailwind-merge`
- `@radix-ui/react-dialog`, `dropdown-menu`, `select`, `separator`, `slot`, `tabs`, `tooltip`
- `components.json` (shadcn new-york, existing CSS variables)

No extra animation library (Motion kept).

## Files created / modified (UI layer)

### Created

- `components/coach/dashboard/CoachDashboard.tsx`
- `components/coach/dashboard/CreateSessionDialog.tsx`
- `components/coach/dashboard/index.ts`
- `components/ui/Sheet.tsx`, `DropdownMenu.tsx`, `Tabs.tsx` (+ Radix Select)
- `docs/coach-dashboard-v2/*`

### Modified

- `app/coach/page.tsx` → `CoachDashboard`
- `components/coach/layout/*` (Shell, Sidebar, Header, Navigation, Content)
- `components/ui/Button.tsx`, `IconButton.tsx`, `Select.tsx`
- `lib/cn.ts` (twMerge + clsx)
- `styles/coach.css`, token primary mapping
- `components/sessions/CoachSessionDashboard.tsx` (lint: ref sync via effect)

## Components reused

- Design System tokens / themes (`data-theme`, `data-experience="coach"`)
- `BrandMark`, `Badge`, `Card`, `Dialog`, `Skeleton`, `Separator`, `Tooltip`
- Existing `/api/sessions` list + create + delete
- Better Auth coach session (unchanged)
- `CreateSessionDialog` → V1 session create payload (`testSlugs`)

## Behavior preserved

- Coach auth gate
- Session create / list / open / remove
- Theme switch in header
- Players / Reports nav soft-disabled until routes exist

## Remaining issues

- Next.js 16.4.0 security nudge in dev overlay (ask before `next upgrade --agent=security`)
- Players & Reports routes not implemented (UI intentionally disabled)
- FastAPI client layer present but unused by this dashboard (still V1 `/api/sessions`)
- Cursor browser screenshot panel may crop the right edge; CDP confirms 4-col overview at 1194×834 content width ~906px
