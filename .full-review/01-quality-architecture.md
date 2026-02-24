# Phase 1: Code Quality & Architecture Review

## Code Quality Findings

### Critical

| # | File | Issue | Severity |
|---|------|-------|----------|
| C1 | `src/lib/auth.ts` | In-memory token store (`Map` on `globalThis`) — sessions lost on every restart | Critical |
| C2 | `src/proxy.ts` | Middleware only checks cookie existence, never validates the token value | Critical |
| C3 | `src/app/api/auth/login/route.ts:8` | Password compared with `!==` — timing-attack vulnerable | Critical |

### High

| # | File | Issue | Severity |
|---|------|-------|----------|
| H1 | `catalog/route.ts`, `catalog/[id]/route.ts`, `CatalogForm.tsx` | ~30-field `allowedFields` list copy-pasted in 3 files | High |
| H2 | `src/app/api/catalog/route.ts` (210 lines) | Single GET handler with 5 distinct `groupBy` modes, cyclomatic complexity ~12 | High |
| H3 | `src/app/api/catalog/route.ts:254–295` | POST handler manually re-enumerates every field in `prisma.create` | High |
| H4 | `catalog/[id]/page.tsx`, `spool/[id]/page.tsx` | `ParamSection` / `SpoolParamSection` are character-for-character identical | High |
| H5 | 4+ page files | `GlobalFilament` interface (30+ fields) redefined in every file | High |
| H6 | `src/components/ColorSwatch.tsx:13` | `color_hex` injected into `style` prop without hex format validation | High |
| H7 | `api/locations/route.ts:44–49`, `api/locations/[id]/route.ts:65–70` | Default-location toggle uses two separate queries — race condition | High |
| H8 | `src/lib/fetch.ts:14` | `Content-Type: application/json` hardcoded for all requests — breaks FormData uploads | High |

### Medium

| # | File | Issue | Severity |
|---|------|-------|----------|
| M1 | ~8 page files | Inline back-arrow SVG copy-pasted everywhere; `lucide-react` already available | Medium |
| M2 | All client pages | No React error boundary / `error.tsx` — unhandled errors show white screen | Medium |
| M3 | `src/components/QRScanner.tsx:45` | `onResult` in `useEffect` deps causes scanner restart on every parent render | Medium |
| M4 | `api/locations/[id]/route.ts:100–107` | Location delete (nullify spools + delete) not wrapped in `$transaction` | Medium |
| M5 | `location/[id]/page.tsx`, `spool/[id]/page.tsx` | `window.location.origin` used for QR URLs — fragile, inconsistent with print pages | Medium |
| M6 | `prisma/schema.prisma:17–65` | Numeric fields (`nozzle_temp`, `bed_temp`, `density`, etc.) typed as `String?` | Medium |
| M7 | `src/components/CatalogForm.tsx` (472 lines) | Monolithic component — form state, brand select, logo upload, submission all in one | Medium |
| M8 | Multiple files | Empty `catch {}` blocks silently swallow errors | Medium |
| M9 | `spool/[id]/print/spool-label-printer.tsx:11–14` | Font loaded via 5-level `../../../../../` relative path | Medium |
| M10 | `src/proxy.ts` | File is not wired as Next.js middleware (must be `src/middleware.ts`) | Medium |

### Low

| # | File | Issue | Severity |
|---|------|-------|----------|
| L1 | `src/components/StatusBadge.tsx` | Only handles `ACTIVE`/`EMPTY` — new statuses silently fall through | Low |
| L2 | `src/lib/location-types.ts:12` | Magic index `LOCATION_TYPES[4]` as fallback | Low |
| L3 | `src/app/api/auth/login/route.ts:13` | `expiresAt` duplicates `TOKEN_TTL` from `auth.ts` | Low |
| L4 | `src/app/(auth)/login/page.tsx:43` | Cookie set without `Secure` flag | Low |
| L5 | `src/app/location/[id]/print/page.tsx:108–112` | `dangerouslySetInnerHTML` for print auto-trigger | Low |
| L6 | `CatalogForm.tsx`, `catalog/page.tsx`, `spool-label-printer.tsx` | Raw `<img>` tags instead of `next/image` | Low |

---

## Architecture Findings

### Critical

| # | File | Issue | Severity |
|---|------|-------|----------|
| A-C1 | `src/proxy.ts` | Middleware exported but never wired — page routes are completely unprotected | Critical |
| A-C2 | `src/lib/auth.ts` | In-memory UUID token store (not JWT as described) — lost on every restart | Critical |

### High

| # | File | Issue | Severity |
|---|------|-------|----------|
| A-H1 | `src/app/(auth)/login/page.tsx`, `src/lib/fetch.ts`, `src/proxy.ts` | Dual token storage (localStorage + cookie) with no sync; no logout mechanism | High |
| A-H2 | `src/app/api/catalog/route.ts` | 5 completely different response shapes from one endpoint | High |
| A-H3 | All API routes | No schema validation library (Zod/Yup) — ad-hoc `if (!field)` checks throughout | High |
| A-H4 | `spool/[id]/page.tsx`, `catalog/[id]/page.tsx`, `spool-label-printer.tsx`, `CatalogForm.tsx` | `GlobalFilament` type (30+ fields) duplicated across 4+ files with drift | High |

### Medium

| # | File | Issue | Severity |
|---|------|-------|----------|
| A-M1 | All list endpoints | No pagination — full table scans with in-memory aggregation | Medium |
| A-M2 | `prisma/schema.prisma:94` | Spool `status` is free-form `String` — no enum constraint | Medium |
| A-M3 | `prisma/schema.prisma:98–99` | No `onDelete: Restrict` on `GlobalFilament → Spool` relation | Medium |
| A-M4 | `catalog/[id]/edit/page.tsx` vs `catalog/[id]/page.tsx` | Mixed data-fetching patterns: Server Component direct Prisma vs Client Component API fetch | Medium |
| A-M5 | `src/app/(auth)/layout.tsx`, `src/app/layout.tsx` | Desktop `SideNav` renders on login page — auth layout doesn't suppress nav | Medium |
| A-M6 | All client pages | Every page independently implements loading/error state boilerplate | Medium |

### Low

| # | File | Issue | Severity |
|---|------|-------|----------|
| A-L1 | `prisma/schema.prisma` | `GlobalFilament` and `Spool` missing `updated_at @updatedAt` | Low |
| A-L2 | All API routes | Inconsistent success response shapes (`{ success: true }`, entity object, `{ updated: count }`) | Low |
| A-L3 | `api/catalog/brand-rename/route.ts` | `brand-rename` uses POST instead of PATCH | Low |
| A-L4 | Page routes | Singular/plural inconsistency (`/spool/[id]` vs `/catalog/[id]`) | Low |
| A-L5 | `src/app/api/logos/[filename]/route.ts` | Logo endpoint publicly accessible (intentional but undocumented) | Low |
| A-L6 | `Dockerfile:5–7` | Dead `npm ci --omit=dev` line runs before full `npm ci`, wasting ~30s | Low |
| A-L7 | `docker-compose.yml:14` | Health check hits `GET /api/auth/login` — only POST is defined, always 405 | Low |
| A-L8 | `package.json` | `prisma` CLI in `dependencies` instead of `devDependencies` (+50MB in prod image) | Low |

---

## Critical Issues for Phase 2 Context

The following findings from Phase 1 should directly inform the security and performance review:

1. **Middleware not wired** (`src/proxy.ts` → should be `src/middleware.ts`): Page routes are completely unprotected. The security review should assess what data is exposed to unauthenticated users via the page shell.

2. **Token validation absent in middleware**: Even if the middleware were wired, it only checks cookie existence — any non-empty cookie value bypasses auth. The security review should assess the full auth bypass surface.

3. **Timing-attack on password comparison**: Direct `!==` comparison leaks timing information on the login endpoint. Brute-force + timing analysis could accelerate password discovery.

4. **Dual token storage with no logout**: Token in both `localStorage` and cookie with no sync and no logout endpoint. XSS could steal the `localStorage` token.

5. **No input validation library**: All API routes use ad-hoc checks. The security review should look for injection vectors and missing validation on every endpoint.

6. **Full table scans with in-memory aggregation**: The catalog endpoint loads all records for every grouped request. The performance review should assess memory and latency impact at scale.

7. **Non-atomic multi-step writes**: Default-location toggle and location delete are non-atomic. The performance review should assess deadlock and corruption risk under concurrent load.
