# Phase 2: Security & Performance Review

## Security Findings

> Note: Phase 1 re-evaluated 6 concerns against the actual codebase — 3 were already resolved (middleware correctly wired at `src/middleware.ts`, HMAC-based stateless tokens, `timingSafeEqual` already used for password). New findings below reflect the real state of the code.

### Critical

| # | File | Issue | CVSS | CWE |
|---|------|-------|------|-----|
| S-C1 | `src/lib/auth.ts:32` | HMAC signature compared with `!==` — timing attack allows byte-by-byte token forgery | 7.5 | CWE-208 |
| S-C2 | `src/app/api/auth/login/route.ts` | Zero rate limiting on login — single shared password is brute-forceable | 8.1 | CWE-307 |
| S-C3 | `src/app/api/upload/logo/route.ts:11`, `src/app/api/logos/[filename]/route.ts:10` | SVG uploads accepted and served raw with `image/svg+xml` — stored XSS, can steal tokens from localStorage | 8.6 | CWE-79 |

### High

| # | File | Issue | CVSS | CWE |
|---|------|-------|------|-----|
| S-H1 | `src/app/(auth)/login/page.tsx:38-39`, `src/lib/fetch.ts:3` | Auth token stored in `localStorage` — XSS-exfiltrable; combined with S-C3 is directly exploitable | 7.1 | CWE-922 |
| S-H2 | `src/app/(auth)/login/page.tsx:43-44` | Cookie set client-side via `document.cookie` — cannot be `HttpOnly`; `Secure` flag only conditional | 6.5 | CWE-614 |
| S-H3 | Codebase-wide | No logout route exists despite middleware referencing `/api/auth/logout` — no token revocation | 5.9 | CWE-613 |
| S-H4 | `next.config.ts` | Zero security headers (no CSP, X-Content-Type-Options, X-Frame-Options, HSTS, Referrer-Policy) | 5.4 | CWE-693 |
| S-H5 | `src/lib/auth.ts:6` | `TOKEN_SECRET` falls back to `APP_PASSWORD` — user password reused as HMAC key, likely low-entropy | 6.2 | CWE-321 |

### Medium

| # | File | Issue | CVSS | CWE |
|---|------|-------|------|-----|
| S-M1 | `src/app/(auth)/login/page.tsx:16`, `src/middleware.ts:27` | Open redirect via unvalidated `from` query param — `router.push(from)` with attacker-controlled URL | 5.4 | CWE-601 |
| S-M2 | All API routes | No schema validation library — ad-hoc `if (!field)` checks allow oversized strings, wrong types, prototype pollution | 4.3 | CWE-20 |
| S-M3 | `src/middleware.ts:4`, `src/app/api/logos/[filename]/route.ts` | Logos endpoint in `PUBLIC_PATHS` with no `requireAuth` — all uploaded images world-readable | 4.3 | CWE-306 |
| S-M4 | `src/app/api/spools/[id]/route.ts:35-38` | `metadata` field accepts `unknown` with no type or size validation — potential DB bloat | 4.0 | CWE-502 |

### Low

| # | File | Issue | CVSS | CWE |
|---|------|-------|------|-----|
| S-L1 | `Dockerfile:45` | `npx prisma migrate deploy` in production CMD — `npx` can trigger network download if binary missing | 3.1 | CWE-426 |
| S-L2 | All POST/PATCH/DELETE routes | No explicit CSRF tokens — mitigated by `SameSite=Lax` + Bearer token requirement, residual risk low | 3.5 | CWE-352 |

---

## Performance Findings

> Note: Phase 1 concerns about non-atomic writes were verified as **already resolved** — both default-location toggle and location delete are correctly wrapped in `prisma.$transaction`.

### Critical

| # | File | Issue | Impact |
|---|------|-------|--------|
| P-C1 | `src/app/api/catalog/route.ts:18–188` | All 4 `groupBy` modes do full-table `findMany()` + in-memory JS aggregation — response time grows linearly with catalog size | Full table scan per request; ~150KB+ JSON at 500 rows |
| P-C2 | `/api/spools`, `/api/catalog`, `/api/locations` | No pagination on any list endpoint — entire table returned on every request | ~1.5MB payload at 5000 spools; spools page fires 2 parallel full scans |

### High

| # | File | Issue | Impact |
|---|------|-------|--------|
| P-H1 | `prisma/schema.prisma` | No `@@index` on `Spool.global_filament_id`, `Spool.location_id`, `Spool.status` — FK lookups do full Spool table scans | Every `_count: { spools }` in catalog API is a full scan |
| P-H2 | `src/app/api/catalog/[id]/route.ts:63–74` | TOCTOU race: manual `count` check before `delete` — spool could be created between the two queries | Data integrity violation under concurrent requests |
| P-H3 | All GET list handlers | No `Cache-Control` headers on any read endpoint — every page load re-fetches full catalog/spool/location lists | Unnecessary DB load; no browser/CDN caching |
| P-H4 | All page files | Every page is `"use client"` with post-hydration API fetch — no SSR | First paint shows spinner; extra round trip for every page |
| P-H5 | `data/logos/` filesystem storage | Logo files on local disk — breaks horizontal scaling; lost on container recreation | Multi-instance deployment impossible |

### Medium

| # | File | Issue | Impact |
|---|------|-------|--------|
| P-M1 | `src/lib/db.ts:13` | Prisma singleton not cached in production (`!== "production"` guard) — new `PrismaClient` per cold start | SQLite file lock exhaustion in serverless/edge |
| P-M2 | `src/app/api/catalog/route.ts` | `LIKE '%q%'` search on `brand`, `material`, `color_name` without index — always full table scan | Degrades with catalog size |
| P-M3 | `src/app/api/logos/[filename]/route.ts` | `readFile()` loads entire image into memory per request — no streaming | 5MB per concurrent request on cold cache |
| P-M4 | `src/components/CatalogForm.tsx:174–193` | Two parallel full-scan API calls on every form mount (`groupBy=material` + `groupBy=brandList`) | 200–800ms added to form open time |
| P-M5 | `src/app/spools/page.tsx:58–61` | Two parallel requests (`?status=ACTIVE` + `?status=EMPTY`) instead of one | Two full table scans where one would do |
| P-M6 | `prisma/schema.prisma` | No uniqueness constraint on `(brand, material, color_name)` — concurrent POSTs create duplicate catalog entries | Silent data duplication |
| P-M7 | `src/app/catalog/page.tsx:35–52` | `isSearching` in `useEffect` deps causes double-fire on query change | Debounce timer resets twice per keystroke |
| P-M8 | `src/app/catalog/[id]/page.tsx:85`, `spool/[id]/page.tsx:152` | `<Image unoptimized>` — disables WebP conversion, responsive sizing, lazy loading | No benefit over plain `<img>` |
| P-M9 | `src/components/QRScanner.tsx` | `html5-qrcode` (~180KB) not code-split — loaded in initial bundle even when scanner not used | +180KB on every page |

### Low

| # | File | Issue | Impact |
|---|------|-------|--------|
| P-L1 | `package.json` | `formidable` + `@types/formidable` imported but never used | +~200KB server bundle |
| P-L2 | `src/app/api/upload/logo/route.ts:43` | `mkdir` called on every upload request | Unnecessary syscall |
| P-L3 | `src/app/catalog/page.tsx:121` | `Array.includes` in render loop for material type columns | O(n) per cell; negligible but avoidable |

---

## Critical Issues for Phase 3 Context

The following findings should inform the testing and documentation review:

1. **SVG XSS + localStorage token (S-C3 + S-H1)**: The most severe combined vulnerability. Tests should verify SVG upload is blocked or sanitized, and that tokens are not accessible via `localStorage` after the fix.

2. **No rate limiting on login (S-C2)**: Tests should cover brute-force protection — verify 429 responses after N failed attempts.

3. **Open redirect (S-M1)**: Tests should verify that `from` param with absolute URLs is rejected and redirects to default.

4. **No pagination (P-C2)**: Documentation should note the current scale limits. Tests should verify list endpoints return bounded results once pagination is added.

5. **Full-table scan aggregations (P-C1)**: Performance tests / benchmarks are missing entirely. The catalog `groupBy` endpoints have no test coverage.

6. **No logout endpoint (S-H3)**: Tests should verify that after logout the token is invalidated and protected routes return 401.

7. **Missing security headers (S-H4)**: Tests should assert presence of CSP, X-Frame-Options, etc. in response headers.
