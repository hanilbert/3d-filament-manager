# Architectural Design Review — 3d-filament-manager

**Reviewed**: 2026-02-23
**Stack**: Next.js 16 (App Router), Prisma + SQLite, Tailwind CSS, shadcn/ui, in-memory token auth
**Scope**: Full codebase — data model, API layer, auth, components, deployment

---

## 1. Data Model

### 1.1 All numeric/physical fields stored as `String?`

**Severity**: High
**Location**: `prisma/schema.prisma` — `GlobalFilament` model (lines 17–65)

Every physical parameter (`nozzle_temp`, `bed_temp`, `density`, `diameter`, `fan_min`, `fan_max`, etc.) is typed `String?`. This means:

- No database-level range validation or constraint enforcement.
- Sorting/filtering by numeric value is impossible at the query level (e.g. "find all filaments with nozzle temp > 220").
- The API layer (`catalog/[id]/route.ts` line 54) coerces values with `body[f] || null`, which silently converts `0` to `null`.

**Recommendation**: Introduce typed columns (`Float?`, `Int?`) for genuinely numeric fields. Keep `String?` only for fields that are truly free-text (like `ams_compatibility`, `build_plates`). If backward compatibility is a concern, a migration can cast existing string values.

### 1.2 No `updated_at` on `GlobalFilament` or `Spool`

**Severity**: Low
**Location**: `prisma/schema.prisma`

`Location` has `updated_at @updatedAt` (line 85), but `GlobalFilament` and `Spool` do not. This makes it impossible to track when a catalog entry was last edited or when a spool's status changed.

**Recommendation**: Add `updated_at DateTime @updatedAt` to both models.

### 1.3 Spool `status` is a free-form `String`

**Severity**: Medium
**Location**: `prisma/schema.prisma` line 94

The status field defaults to `"ACTIVE"` but has no enum constraint. Any arbitrary string can be written via the PATCH endpoint (`spools/[id]/route.ts` line 38 — `status` is in `allowedFields`). The frontend only renders `"ACTIVE"` and `"EMPTY"`, so an invalid status would create a ghost record.

**Recommendation**: Either use a Prisma `enum SpoolStatus { ACTIVE EMPTY }` or add explicit validation in the API handler before writing.

### 1.4 No cascade delete on `GlobalFilament → Spool`

**Severity**: Medium
**Location**: `prisma/schema.prisma` lines 98–99

The `catalog/[id]/route.ts` DELETE handler manually checks `spoolCount > 0` before deleting (line 79). This is correct application logic, but there's no `onDelete` clause in the schema. If someone bypasses the API (e.g. direct DB access, a future migration script), orphaned spools could be created.

**Recommendation**: Add `onDelete: Restrict` to the `globalFilament` relation on `Spool` to enforce this at the database level.

---

## 2. Authentication & Security

### 2.1 In-memory token store — tokens lost on restart

**Severity**: Critical
**Location**: `src/lib/auth.ts`

Tokens are stored in a `Map<string, number>` on `globalThis`. Every server restart (deploy, crash, container recreation) invalidates all active sessions. In a Docker environment with `restart: unless-stopped`, this means any OOM kill or update forces every user to re-authenticate.

**Architectural impact**: This is acceptable for a single-user home-lab tool, but it's the single biggest scalability bottleneck. It also means the system cannot support multiple server instances.

**Recommendation**: If this remains single-instance, document the trade-off explicitly. Otherwise, persist tokens in the SQLite database or use signed JWTs (the project description says "JWT-based" but the implementation is UUID-based opaque tokens).

### 2.2 Middleware exists as `src/proxy.ts` but is never wired as Next.js middleware

**Severity**: Critical
**Location**: `src/proxy.ts`

The file exports a `proxy()` function and a `config` matcher, but Next.js middleware must be at `src/middleware.ts` (or `middleware.ts` at the project root). No `middleware.ts` file exists in the project. This means:

- The cookie-based page-route protection described in the comments **is not active**.
- Unauthenticated users can access any page route directly (the API routes are still protected by `requireAuth`, so data won't load, but the page shell renders).

**Recommendation**: Rename `src/proxy.ts` to `src/middleware.ts` and ensure the `proxy` function is exported as `default` or as `middleware`.

### 2.3 Dual-token storage (localStorage + Cookie) with no sync

**Severity**: High
**Location**: `src/app/(auth)/login/page.tsx` lines 38–43, `src/lib/fetch.ts`, `src/proxy.ts`

The login page stores the token in both `localStorage` (for API `Authorization` headers) and a `document.cookie` (for middleware). But:

- The cookie `max-age` is hardcoded to 7 days, while the server token TTL is also 7 days — but they start from different clocks (client vs. server).
- On 401, `apiFetch` clears `localStorage` but not the cookie. The (non-functional) middleware would still see a stale cookie and let the user through to page routes.
- There's no logout endpoint or mechanism to clear both stores.

**Recommendation**: Use a single source of truth. An `HttpOnly` cookie set by the server (via `Set-Cookie` response header in the login API) would eliminate the need for `localStorage` entirely and be more secure (no XSS access to the token).

### 2.4 Logo endpoint is publicly accessible — no auth

**Severity**: Low
**Location**: `src/proxy.ts` line 3, `src/app/api/logos/[filename]/route.ts`

`/api/logos` is in `PUBLIC_PATHS`, and the GET handler has no `requireAuth` call. This is intentional (logos need to render in label images, print pages, etc.), but it means any uploaded image is world-readable. The upload endpoint *is* protected, so the risk is limited to information disclosure of brand logos.

**Recommendation**: Acceptable as-is for a home-lab tool. Document the decision.

---

## 3. API Design

### 3.1 Overloaded `GET /api/catalog` — 5 modes in one endpoint

**Severity**: High
**Location**: `src/app/api/catalog/route.ts` (302 lines)

This single endpoint handles:
1. Flat list with search (`q`, `brand`, `material`, `materialType` params)
2. Brand grouping (`groupBy=brand`)
3. Brand list dedup (`groupBy=brandList`)
4. Material type grouping (`groupBy=material`)
5. Sub-material listing (`groupBy=materialType`)

Each mode has completely different response shapes. This violates the principle of predictable API contracts — a consumer cannot know the response type without inspecting the `groupBy` parameter. The in-memory aggregation (lines 46–76, 102–127, 156–177) also loads all records into memory for every request.

**Recommendation**: Split into dedicated endpoints:
- `GET /api/catalog` — flat list with search
- `GET /api/catalog/brands` — brand grouping
- `GET /api/catalog/materials` — material type grouping
- `GET /api/catalog/materials/[type]` — sub-material listing

### 3.2 No pagination on any list endpoint

**Severity**: Medium
**Location**: All `GET` list handlers (`catalog/route.ts`, `spools/route.ts`, `locations/route.ts`)

Every list endpoint returns all records. For a personal filament tracker this is fine at small scale, but the catalog endpoint does full-table scans with in-memory aggregation. With hundreds of filament entries, response times will degrade.

**Recommendation**: Add optional `limit`/`offset` or cursor-based pagination. At minimum, add it to the flat catalog list.

### 3.3 Inconsistent error response shapes

**Severity**: Low
**Location**: All API routes

Success responses vary: `{ success: true }` for deletes, the entity object for creates/updates, `{ updated: count }` for brand-rename. Error responses are consistently `{ error: string }`, which is good, but the success side has no contract.

**Recommendation**: Standardize on a response envelope or at least document the expected shapes per endpoint.

### 3.4 `brand-rename` uses POST instead of PATCH/PUT

**Severity**: Low
**Location**: `src/app/api/catalog/brand-rename/route.ts`

A rename operation is semantically an update. Using POST makes it look like a creation endpoint.

**Recommendation**: Use `PATCH /api/catalog/brands/[brand]` with `{ name: newBrand }` body.

---

## 4. Component Architecture

### 4.1 Duplicated type definitions across pages

**Severity**: High
**Location**: `SpoolDetail` in `spool/[id]/page.tsx`, `GlobalFilament` in `spool-label-printer.tsx`, `CatalogDetail` in `catalog/[id]/page.tsx`, `FormValues` in `CatalogForm.tsx`

The `GlobalFilament` field set (30+ optional string fields) is redefined as an inline interface in at least 4 different files. Each copy can drift independently. For example, `spool-label-printer.tsx` defines `GlobalFilament` with a subset of fields (missing `ironing_flow`, `ironing_speed`, etc.), while `spool/[id]/page.tsx` has the full set.

**Recommendation**: Create a shared `src/types/` directory with canonical types generated from or aligned with the Prisma schema. Use `Prisma.GlobalFilamentGetPayload<{}>` or a manually maintained shared type.

### 4.2 Duplicated `ParamSection` / `SpoolParamSection` components

**Severity**: Medium
**Location**: `catalog/[id]/page.tsx` lines 67–83, `spool/[id]/page.tsx` lines 62–78

These are identical components with different names. Both render a grid of label/value pairs, filtering out empty values.

**Recommendation**: Extract to `src/components/ParamSection.tsx` and import in both pages.

### 4.3 Inline SVG icons repeated everywhere

**Severity**: Medium
**Location**: Back-arrow SVG in ~8 page files, chevron-right in ~4 files, flask icon in 2 files

The same back-arrow `<svg>` block is copy-pasted in `spool/[id]/page.tsx`, `catalog/[id]/page.tsx`, `catalog/brand/[brand]/page.tsx`, `catalog/material/[material]/page.tsx`, `catalog/material-type/[type]/page.tsx`, `location/[id]/page.tsx`, `location/[id]/edit/page.tsx`, `locations/new/page.tsx`.

**Recommendation**: The project already depends on `lucide-react`. Replace inline SVGs with `<ChevronLeft />`, `<ChevronRight />`, `<Flask />` etc. from that library.

### 4.4 Server Components doing direct Prisma queries alongside Client Components fetching via API

**Severity**: Medium
**Location**: `catalog/[id]/edit/page.tsx` (Server Component, direct Prisma), `catalog/[id]/page.tsx` (Client Component, `apiFetch`)

The edit page is a Server Component that calls `prisma.globalFilament.findUnique()` directly, while the detail page is a Client Component that fetches via `/api/catalog/${id}`. This inconsistency means:

- The edit page bypasses the API auth layer (no `requireAuth` check — it relies on middleware that isn't wired).
- Two different data-fetching patterns for the same entity.

**Recommendation**: Pick one pattern and apply it consistently. If using Server Components with direct DB access, ensure middleware auth is functional. If using client-side fetching, make the edit page a Client Component too.

---

## 5. Design Patterns

### 5.1 No data validation layer

**Severity**: High
**Location**: All API route handlers

Request body validation is done with ad-hoc `if (!field)` checks. There's no schema validation library (Zod, Yup, etc.). The `allowedFields` pattern in `catalog/[id]/route.ts` and `spools/[id]/route.ts` is a manual allowlist that must be kept in sync with the Prisma schema — and it's duplicated between the POST and PATCH handlers.

**Recommendation**: Introduce Zod schemas co-located with the API routes. This gives you type-safe parsing, consistent error messages, and a single source of truth for field definitions.

### 5.2 No error boundary or loading state abstraction

**Severity**: Low
**Location**: Every client page

Every page independently implements `const [loading, setLoading] = useState(true)` and renders `加载中...` / `不存在` states. This is ~10 lines of boilerplate per page.

**Recommendation**: Create a `useAsyncData<T>(fetcher)` hook or use React Suspense boundaries to standardize loading/error states.

### 5.3 `QRScanner` has a stale-closure risk

**Severity**: Medium
**Location**: `src/components/QRScanner.tsx` line 45

The `useEffect` depends on `[onResult]`, but `onResult` is typically an inline arrow function from the parent, which changes on every render. This can cause the scanner to stop and restart repeatedly. The `html5-qrcode` library's `start`/`stop` cycle is expensive (camera re-initialization).

**Recommendation**: Either `useCallback` the `onResult` in the parent (already done in `spool/[id]/page.tsx` — `handleScanResult` is not memoized though), or use a ref to hold the latest callback inside `QRScanner`.

---

## 6. Deployment & Infrastructure

### 6.1 Dockerfile `npm ci` runs twice

**Severity**: Low
**Location**: `Dockerfile` lines 5–7

```dockerfile
RUN npm ci --omit=dev --ignore-scripts
RUN npm ci --ignore-scripts
```

The first `npm ci --omit=dev` is immediately overwritten by the second `npm ci` (which installs everything). The first line is dead code that adds ~30s to the build.

**Recommendation**: Remove line 5.

### 6.2 Health check hits the login endpoint

**Severity**: Low
**Location**: `docker-compose.yml` line 14

```yaml
test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/auth/login"]
```

`GET /api/auth/login` is not defined — only `POST` is. This means `wget` will get a 405 Method Not Allowed, which is a non-zero exit code, and the health check will always fail (or succeed only because `wget` returns 0 on any HTTP response — depends on version).

**Recommendation**: Add a dedicated `GET /api/health` endpoint that returns 200, or use a TCP check.

### 6.3 `prisma` is in `dependencies` instead of `devDependencies`

**Severity**: Low
**Location**: `package.json` line 21

The `prisma` CLI package is a dev tool (used for `generate` and `migrate`). It's 50+ MB and gets included in the production image. Only `@prisma/client` is needed at runtime.

**Recommendation**: Move `prisma` to `devDependencies`. In the Dockerfile, use `npx prisma` from the builder stage (already done) and ensure the runner stage only has `@prisma/client`.

---

## 7. Architectural Consistency

### 7.1 Route naming inconsistency: singular vs. plural

**Severity**: Low
**Location**: File system routes

- List pages: `/spools`, `/locations`, `/catalog` (plural or collective)
- Detail pages: `/spool/[id]`, `/location/[id]`, `/catalog/[id]`
- API routes: `/api/spools/[id]`, `/api/locations/[id]`, `/api/catalog/[id]` (all plural)

The page routes mix singular (`/spool/[id]`) and plural (`/catalog/[id]`) for detail views, while the API is consistently plural. This is a minor inconsistency but can confuse contributors.

**Recommendation**: Standardize on plural for both page and API routes (e.g. `/spools/[id]`, `/locations/[id]`).

### 7.2 Auth layout doesn't suppress navigation

**Severity**: Medium
**Location**: `src/app/(auth)/layout.tsx`, `src/app/layout.tsx`

The `(auth)` route group layout is a passthrough (`<>{children}</>`). The root layout always renders `SideNav` and `ConditionalNav`. `ConditionalNav` hides the bottom nav on `/login`, but the desktop `SideNav` is always visible — including on the login page. This means on desktop, the login page shows the full sidebar navigation.

**Recommendation**: Either move the nav rendering into a conditional wrapper that checks the pathname (like `ConditionalNav` does), or restructure the layout groups so `(auth)` truly opts out of the nav shell.

---

## Summary

The project is well-structured for a personal-use Next.js application. The core domain model (Catalog → Spool → Location) is clean, the component library usage is consistent, and the mobile-first responsive design is thoughtfully implemented.

The most impactful issues to address are:
1. **Middleware not wired** — page routes are unprotected (Critical)
2. **In-memory token store** — sessions lost on restart (Critical)
3. **Overloaded catalog endpoint** — 5 response shapes in one route (High)
4. **Duplicated type definitions** — 30+ field interfaces copied across files (High)
5. **No request validation library** — ad-hoc checks with no schema (High)
