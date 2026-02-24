# Performance & Scalability Analysis
**Project:** 3d-filament-manager
**Stack:** Next.js 15 App Router · Prisma 6 / SQLite · Tailwind CSS · shadcn/ui
**Date:** 2026-02-23

---

## Executive Summary

The application is well-structured for a personal-scale tool, but carries several patterns that will degrade noticeably once the catalog grows beyond a few hundred rows. The most critical issues are full-table-scan aggregations in the catalog API, unbounded list endpoints with no pagination, and a logo-serving route that reads the file from disk on every request despite already setting an immutable cache header. Secondary concerns include two parallel API calls on the spools page that could be one, a missing database index on the most-queried foreign key, and a `formidable` dependency that is imported but never used.

---

## 1. Database Performance

### 1.1 Full-Table Scans for Every Aggregation Mode
**Severity: Critical**
**Estimated impact:** Response time grows linearly with catalog size. At 1 000 rows the four groupBy modes each issue a `SELECT *` (or near-`*`) and then aggregate entirely in JavaScript.

`src/app/api/catalog/route.ts` lines 18–188 contain four separate code paths — `brandList`, `brand`, `material`, `materialType` — that all call `prisma.globalFilament.findMany()` with no `where` clause (except `materialType` mode). Every field needed for aggregation is fetched, but the aggregation itself is done with `Map` / `Set` in Node.js rather than in the database.

SQLite supports `GROUP BY`, `COUNT()`, and `DISTINCT` natively. Pushing the work into the query eliminates the full row transfer and the in-memory loop.

**Recommendation — replace `brandList` mode with a raw grouped query:**
```ts
// Before (loads every row, deduplicates in JS)
const items = await prisma.globalFilament.findMany({
  select: { brand: true, logo_url: true },
});
const map = new Map<string, string | null>();
for (const item of items) { /* ... */ }

// After (one aggregation query, zero JS loop)
const rows = await prisma.$queryRaw<{ brand: string; logo_url: string | null }[]>`
  SELECT brand, MAX(logo_url) AS logo_url
  FROM GlobalFilament
  GROUP BY brand
  ORDER BY brand ASC
`;
return NextResponse.json(rows);
```

Apply the same pattern to the `brand`, `material`, and `materialType` modes using `GROUP BY` with `COUNT(*)` and `COUNT(DISTINCT ...)`.

---

### 1.2 Missing Index on `global_filament_id` Foreign Key
**Severity: High**
**Estimated impact:** Every `spool.count({ where: { global_filament_id: id } })` and every `_count: { select: { spools: true } }` in the catalog API performs a full scan of the `Spool` table.

Prisma does **not** automatically create indexes on foreign key columns in SQLite. The schema (`prisma/schema.prisma`) has no `@@index` directive on `Spool.global_filament_id` or `Spool.location_id`.

**Recommendation — add indexes to `schema.prisma`:**
```prisma
model Spool {
  id                 String      @id @default(uuid())
  global_filament_id String
  location_id        String?
  status             SpoolStatus @default(ACTIVE)
  // ...

  @@index([global_filament_id])
  @@index([location_id])
  @@index([status])                // used in WHERE status = 'ACTIVE' filters
}

model GlobalFilament {
  // ...
  @@index([brand])
  @@index([material_type])
}
```

Then run `npx prisma migrate dev`.

---

### 1.3 Two-Query Pattern for Catalog DELETE (TOCTOU Race)
**Severity: High**
**Estimated impact:** Under concurrent requests a spool could be created between the `count` check and the `delete`, causing a silent data-integrity violation.

`src/app/api/catalog/[id]/route.ts` lines 63–74:
```ts
const spoolCount = await prisma.spool.count({ where: { global_filament_id: id } });
if (spoolCount > 0) { /* reject */ }
await prisma.globalFilament.delete({ where: { id } });
```

The `onDelete: Restrict` constraint on the relation (`schema.prisma` line 105) already enforces this at the database level, so the explicit count check is redundant and introduces a race window.

**Recommendation:** Remove the manual count check and rely on the Prisma `P2003` foreign-key violation error:
```ts
try {
  await prisma.globalFilament.delete({ where: { id } });
  return NextResponse.json({ success: true });
} catch (e: unknown) {
  const code = (e as { code?: string })?.code;
  if (code === "P2003") {
    return NextResponse.json({ error: "该耗材关联了料卷，无法删除" }, { status: 400 });
  }
  throw e;
}
```

---

### 1.4 Prisma Singleton — Production Branch Not Cached
**Severity: Medium**
**Estimated impact:** In production (`NODE_ENV === "production"`) the singleton guard is skipped (`if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma`). In a long-running Node.js process this is fine, but in a serverless or edge deployment each cold-start creates a new `PrismaClient` instance, exhausting the SQLite file lock.

`src/lib/db.ts` line 13 only stores the singleton in `globalThis` during development. The standard Next.js pattern stores it unconditionally:

**Recommendation:**
```ts
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Always cache — safe in both dev (HMR) and prod (single process)
globalForPrisma.prisma = prisma;
```

---

### 1.5 `contains` Filter Without Index — Full-Text Search
**Severity: Medium**
**Estimated impact:** The flat-list search (`/api/catalog?q=...`) uses `{ contains: q }` on `brand`, `material`, and `color_name`. SQLite translates this to `LIKE '%q%'` which cannot use a B-tree index and always scans the full table.

**Recommendation (short-term):** Add a composite index on the three searched columns and accept the scan cost at small scale. For larger catalogs, enable SQLite FTS5 via a raw migration and query it with `prisma.$queryRaw`.

---

## 2. Memory Management

### 2.1 Unbounded In-Memory Sets in Aggregation Loops
**Severity: Medium**
**Estimated impact:** Each `groupBy=brand` request allocates a `Map` of `Set<string>` objects proportional to the number of distinct brands × materials. At 10 000 catalog rows with 50 brands and 40 material types, this is negligible. At 100 000 rows it becomes a GC pressure point per request.

The root fix is moving aggregation to SQL (see §1.1). Until then, the Sets are bounded by the number of distinct values, not the total row count, so this is low urgency.

---

### 2.2 Logo Route Reads Entire File Into Memory Per Request
**Severity: Medium**
**Estimated impact:** `src/app/api/logos/[filename]/route.ts` calls `readFile(filePath)` which loads the entire image into a `Buffer` before streaming it. A 5 MB SVG logo (the upload limit) means 5 MB allocated per concurrent request with no streaming.

The route already sets `Cache-Control: public, max-age=31536000, immutable`, so a CDN or browser will cache it after the first hit. The problem only manifests on cold cache or when many clients first load the app simultaneously.

**Recommendation:** Use `createReadStream` and pipe it, or — better — serve the `data/logos/` directory as a static asset via Next.js `public/` folder or a dedicated static file server, eliminating the API route entirely.

---

### 2.3 `formidable` Dependency Is Unused
**Severity: Low**
**Estimated impact:** `formidable` (and `@types/formidable`) appear in `package.json` but are not imported anywhere in the codebase. The upload route uses the native `request.formData()` API. This adds ~200 KB to the server bundle unnecessarily.

**Recommendation:** Remove `formidable` and `@types/formidable` from `package.json`.

---

## 3. Caching Opportunities

### 3.1 No HTTP Caching on Any API Route
**Severity: High**
**Estimated impact:** Every page load re-fetches the full catalog, brand list, and spool list. The catalog brand list and material type list change infrequently but are fetched on every `CatalogForm` mount (two parallel requests) and on every `CatalogPage` load.

**Recommendation:** Add `Cache-Control` headers to read-only list endpoints. Use `stale-while-revalidate` so the UI stays fast while the cache refreshes in the background:
```ts
// In GET handlers for /api/catalog, /api/locations
return NextResponse.json(result, {
  headers: {
    "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
  },
});
```

For the `groupBy=brandList` and `groupBy=material` endpoints used by `CatalogForm`, a 5-minute `stale-while-revalidate` is safe since these are dropdown population calls.

---

### 3.2 `CatalogForm` Fires Two Parallel API Calls on Every Mount
**Severity: Medium**
**Estimated impact:** Every time the new/edit catalog form is opened, it fires `GET /api/catalog?groupBy=material` and `GET /api/catalog?groupBy=brandList` simultaneously. Both are full-table scans (see §1.1). On a slow device or network this adds 200–800 ms to form open time.

`src/components/CatalogForm.tsx` lines 174–193.

**Recommendation:** Combine into a single endpoint or cache the results in a module-level variable with a short TTL:
```ts
// Simple module-level cache (survives HMR in dev, fine for single-process prod)
let cachedBrands: BrandOption[] | null = null;
let brandsExpiry = 0;

async function loadBrands(): Promise<BrandOption[]> {
  if (cachedBrands && Date.now() < brandsExpiry) return cachedBrands;
  cachedBrands = await apiFetch<BrandOption[]>("/api/catalog?groupBy=brandList");
  brandsExpiry = Date.now() + 5 * 60 * 1000;
  return cachedBrands;
}
```

---

## 4. I/O Bottlenecks

### 4.1 No Pagination on Any List Endpoint
**Severity: Critical**
**Estimated impact:** `/api/spools`, `/api/catalog` (flat mode), and `/api/locations` return every row on every request. The spools page fires two parallel requests (`?status=ACTIVE` and `?status=EMPTY`) that together return the entire spool table. At 500 spools the JSON payload is ~150 KB; at 5 000 spools it is ~1.5 MB per page load.

**Recommendation:** Add cursor-based or offset pagination to all list endpoints:
```ts
// /api/spools?status=ACTIVE&page=1&limit=50
const page = parseInt(searchParams.get("page") ?? "1");
const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
const skip = (page - 1) * limit;

const [spools, total] = await prisma.$transaction([
  prisma.spool.findMany({ where, include, orderBy, skip, take: limit }),
  prisma.spool.count({ where }),
]);

return NextResponse.json({ data: spools, total, page, limit });
```

The frontend pages (`spools/page.tsx`, `catalog/page.tsx`) would need corresponding infinite-scroll or "load more" UI.

---

### 4.2 Spools Page Makes Two Requests That Could Be One
**Severity: Medium**
**Estimated impact:** `src/app/spools/page.tsx` lines 58–61 fires `Promise.all` for `?status=ACTIVE` and `?status=EMPTY`. This is two full-table scans instead of one. The tab UI already separates them client-side, so a single `GET /api/spools` (no status filter) with client-side partition would halve the database work.

**Recommendation:** Fetch all spools in one request and split by status on the client:
```ts
const all = await apiFetch<Spool[]>("/api/spools");
setActiveSpools(all.filter((s) => s.status === "ACTIVE"));
setEmptySpools(all.filter((s) => s.status === "EMPTY"));
```

(This becomes moot once pagination is added — at that point the two-request pattern is correct for lazy-loading each tab.)

---

### 4.3 `mkdir` Called on Every Logo Upload
**Severity: Low**
**Estimated impact:** `src/app/api/upload/logo/route.ts` line 43 calls `mkdir(logosDir, { recursive: true })` on every upload request. This is a syscall that always succeeds but is unnecessary after the first upload.

**Recommendation:** Call `mkdir` once at server startup (e.g., in a `instrumentation.ts` file) or cache a boolean flag after the first successful `mkdir`.

---

## 5. Concurrency Issues

### 5.1 Default-Location Toggle Is Now Transactional — Verified Safe
**Severity: N/A (resolved)**
Both `POST /api/locations` and `PATCH /api/locations/[id]` correctly wrap the `updateMany` + `create`/`update` in `prisma.$transaction`. The Phase 1 concern is addressed.

---

### 5.2 Location DELETE Is Transactional — Verified Safe
**Severity: N/A (resolved)**
`DELETE /api/locations/[id]` wraps the `spool.updateMany` (null out `location_id`) and `location.delete` in a single transaction. Safe.

---

### 5.3 Concurrent Catalog POST — No Uniqueness Constraint
**Severity: Medium**
**Estimated impact:** Two simultaneous POST requests with identical `(brand, material, color_name)` will both succeed, creating duplicate catalog entries. There is no unique constraint on the combination.

**Recommendation:** Add a unique constraint if duplicates are undesirable:
```prisma
model GlobalFilament {
  // ...
  @@unique([brand, material, color_name])
}
```

Or handle the `P2002` unique-constraint error in the POST handler to return a 409 Conflict.

---

## 6. Frontend Performance

### 6.1 All Pages Are `"use client"` — No Server-Side Rendering
**Severity: High**
**Estimated impact:** Every page (`catalog/page.tsx`, `spools/page.tsx`, `locations/page.tsx`, `catalog/[id]/page.tsx`, `spool/[id]/page.tsx`) is a client component that fetches data after hydration. This means:
- First Contentful Paint shows a spinner, not content.
- Search engines see no meaningful HTML.
- Time-to-interactive is gated on two round trips (HTML + API fetch).

Next.js 15 App Router supports async Server Components natively. Detail pages (`/catalog/[id]`, `/spool/[id]`) are ideal candidates since their data is determined by the URL.

**Recommendation — convert detail pages to Server Components:**
```tsx
// src/app/catalog/[id]/page.tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function CatalogDetailPage({ params }: { params: { id: string } }) {
  const item = await prisma.globalFilament.findUnique({
    where: { id: params.id },
    include: { spools: { where: { status: "ACTIVE" }, include: { location: true } } },
  });
  if (!item) notFound();
  // render directly — no loading spinner, no client fetch
  return <CatalogDetailView item={item} />;
}
```

Interactive parts (buttons, QR scanner) can remain as small `"use client"` leaf components.

---

### 6.2 Search Debounce Depends on `isSearching` in `useEffect` Deps
**Severity: Medium**
**Estimated impact:** `src/app/catalog/page.tsx` lines 35–52 include `isSearching` in the `useEffect` dependency array. `isSearching` is derived from `q` (`q.trim().length > 0`), so it changes at the same time as `q`. This causes the effect to run twice on the transition from empty to non-empty query: once for `q` changing and once for `isSearching` changing. The debounce timer resets both times, so the net effect is correct but wasteful.

**Recommendation:** Remove `isSearching` from the dependency array since it is fully derived from `q`:
```ts
useEffect(() => {
  const isSearching = q.trim().length > 0; // derive inside the effect
  const t = setTimeout(load, 300);
  return () => clearTimeout(t);
}, [q]); // only q
```

---

### 6.3 `Image` Component Used with `unoptimized` — No Optimization
**Severity: Medium**
**Estimated impact:** Both `catalog/[id]/page.tsx` (line 85) and `spool/[id]/page.tsx` (line 152) use Next.js `<Image>` with `unoptimized`. This disables WebP conversion, responsive sizing, and lazy loading — the main reasons to use `<Image>` over `<img>`. The logo images are served from the custom `/api/logos/` route which bypasses Next.js image optimization entirely.

**Recommendation:** Either move logos to `public/` and let Next.js optimize them, or remove `unoptimized` and configure `remotePatterns` in `next.config.ts` to allow the local API origin. Alternatively, use a plain `<img>` tag consistently since the optimization is already disabled.

---

### 6.4 `html5-qrcode` Loaded Synchronously in Bundle
**Severity: Medium**
**Estimated impact:** `html5-qrcode` (~180 KB minified) is a dependency in `package.json`. Even though `QRScanner.tsx` uses a dynamic `import("html5-qrcode")` inside the `useEffect`, the package is still included in the initial bundle because it is listed as a direct dependency and may be statically analyzed by the bundler.

The `QRScanner` component itself is only rendered when `showScanner === true` on the spool detail page.

**Recommendation:** Wrap `QRScanner` in `next/dynamic` with `ssr: false` at the call site:
```tsx
// src/app/spool/[id]/page.tsx
import dynamic from "next/dynamic";
const QRScanner = dynamic(
  () => import("@/components/QRScanner").then((m) => m.QRScanner),
  { ssr: false }
);
```

This defers the 180 KB chunk until the user taps "修改位置".

---

### 6.5 `BrandTable` Hardcodes Four Material Type Columns
**Severity: Low**
**Estimated impact:** `src/app/catalog/page.tsx` line 121 hardcodes `["PLA", "ABS", "ASA", "TPU"]` as column headers. The `materialTypes` array on each brand group is checked with `Array.includes` inside a render loop — O(n) per cell. With 50 brands × 4 columns this is 200 `includes` calls per render, which is negligible but avoidable.

**Recommendation:** Convert `materialTypes` to a `Set` before rendering:
```tsx
const mtSet = new Set(b.materialTypes);
// then: mtSet.has(mt) instead of b.materialTypes.includes(mt)
```

---

## 7. Scalability Concerns

### 7.1 SQLite Is a Single-Writer Database
**Severity: High (architectural)**
**Estimated impact:** SQLite serializes all writes. Under concurrent write load (multiple users adding spools simultaneously) requests queue behind each other. For a personal or small-team tool this is acceptable. For multi-user deployment, migration to PostgreSQL (Prisma supports it with a one-line datasource change) would remove this bottleneck entirely.

The current schema is clean and portable — no SQLite-specific types are used. Migration cost is low.

---

### 7.2 Logo Files Stored on Local Filesystem
**Severity: High (horizontal scaling)**
**Estimated impact:** Logos are written to `data/logos/` on the server's local disk (`src/app/api/upload/logo/route.ts` line 42). In a containerized or multi-instance deployment, each instance has its own filesystem. A logo uploaded to instance A is invisible to instance B.

**Recommendation:** Store logos in object storage (S3, R2, MinIO) and save only the URL in the database. The upload route becomes a presigned-URL generator; the serving route is eliminated entirely.

---

### 7.3 No Rate Limiting or Request Size Validation Beyond File Upload
**Severity: Medium**
**Estimated impact:** The `POST /api/catalog` endpoint accepts arbitrary JSON bodies. A malicious client could send a body with thousands of fields, causing the JSON parser to allocate large objects. The `next.config.ts` sets `serverActions.bodySizeLimit: "10mb"` but this applies only to Server Actions, not API routes.

**Recommendation:** Add an explicit body size check in the POST handlers, or configure a reverse proxy (nginx) with `client_max_body_size`.

---

## Summary Table

| # | Finding | Severity | Area |
|---|---------|----------|------|
| 1.1 | Full-table scans for all groupBy aggregations | **Critical** | DB |
| 4.1 | No pagination on any list endpoint | **Critical** | I/O |
| 1.2 | Missing indexes on FK columns | **High** | DB |
| 1.3 | TOCTOU race in catalog DELETE | **High** | Concurrency |
| 3.1 | No HTTP caching on read endpoints | **High** | Caching |
| 6.1 | All pages are client-only, no SSR | **High** | Frontend |
| 7.1 | SQLite single-writer bottleneck | **High** | Scalability |
| 7.2 | Logo files on local filesystem | **High** | Scalability |
| 1.4 | Prisma singleton not cached in production | **Medium** | DB |
| 1.5 | LIKE search without index | **Medium** | DB |
| 2.2 | Logo route reads full file into memory | **Medium** | Memory |
| 3.2 | CatalogForm fires two full-scan requests on mount | **Medium** | Caching |
| 4.2 | Spools page makes two requests instead of one | **Medium** | I/O |
| 5.3 | No uniqueness constraint on catalog entries | **Medium** | Concurrency |
| 6.2 | `isSearching` in useEffect deps causes double-fire | **Medium** | Frontend |
| 6.3 | `<Image unoptimized>` negates Next.js optimization | **Medium** | Frontend |
| 6.4 | `html5-qrcode` not code-split | **Medium** | Frontend |
| 7.3 | No request body size limit on API routes | **Medium** | Scalability |
| 2.1 | Unbounded in-memory Sets (mitigated by §1.1 fix) | **Low** | Memory |
| 2.3 | Unused `formidable` dependency | **Low** | Bundle |
| 4.3 | `mkdir` called on every upload | **Low** | I/O |
| 6.5 | `Array.includes` in render loop | **Low** | Frontend |

---

## Recommended Fix Order

1. **Add database indexes** (§1.2) — 10-minute schema change, immediate query speedup.
2. **Replace in-memory aggregations with SQL GROUP BY** (§1.1) — eliminates the biggest CPU and memory cost per request.
3. **Add pagination to list endpoints** (§4.1) — prevents payload blowup as data grows.
4. **Add `Cache-Control` headers to read endpoints** (§3.1) — free latency win with no code complexity.
5. **Code-split `html5-qrcode`** (§6.4) — one-line change, measurable bundle size reduction.
6. **Convert detail pages to Server Components** (§6.1) — improves perceived performance and enables SSR.
7. **Fix Prisma singleton** (§1.4) — one-line change, prevents connection leak in production.
8. **Remove `formidable`** (§2.3) — `npm uninstall formidable @types/formidable`.
