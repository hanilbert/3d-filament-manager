# Code Review Report: 3D Filament Manager

**Date:** 2026-02-24
**Reviewer:** Claude Opus 4.6 (Automated Code Review)
**Scope:** 23 modified files across security, UI/UX, infrastructure, and documentation changes

---

## Summary Counts

| Severity | Count |
|----------|-------|
| Critical | 2     |
| High     | 7     |
| Medium   | 12    |
| Low      | 9     |
| **Total**| **30**|

---

## Critical Issues

### C-1. Token Returned in JSON Response Body Alongside HttpOnly Cookie

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/auth/login/route.ts`
**Lines:** 69-71

```typescript
return NextResponse.json(
  { token, expiresAt },
  { headers: { "Set-Cookie": cookie } }
);
```

**Description:** The entire purpose of using an HttpOnly cookie is to prevent JavaScript from accessing the token. However, the login endpoint simultaneously returns the raw token in the JSON response body. The client-side code at `/src/app/(auth)/login/page.tsx` lines 50-51 then stores this token in `localStorage`:

```typescript
localStorage.setItem("spool_tracker_token", token);
localStorage.setItem("spool_tracker_expires", String(expiresAt));
```

This completely undermines the HttpOnly cookie security improvement. Any XSS vulnerability can read the token from `localStorage`. The comment on line 48-49 says "Keep localStorage as fallback for Bearer header in API requests" but this defeats the entire HttpOnly migration.

**Recommendation:** Complete the migration to HttpOnly cookies. Remove the token from the JSON response body. Ensure `apiFetch` relies solely on `credentials: "same-origin"` to send cookies. The `api-auth.ts` middleware should read from cookies instead of only from the `Authorization` header. The transition should be:
1. Server sets HttpOnly cookie (already done).
2. API routes authenticate via cookie (currently missing in `api-auth.ts`).
3. Client does NOT receive or store the raw token.
4. Remove `localStorage` token storage entirely.

---

### C-2. API Route Authentication Only Checks Bearer Header, Not Cookies

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/lib/api-auth.ts`
**Lines:** 4-12

```typescript
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  const token = extractBearerToken(
    request.headers.get("Authorization")
  );
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
```

**Description:** The middleware (`middleware.ts` line 19) correctly reads the token from cookies for page-level auth. But the `requireAuth` function used by all API routes only checks the `Authorization: Bearer` header. This means:

1. If you successfully complete the HttpOnly migration (removing token from response body and localStorage), ALL API calls will break because `apiFetch` sends the token via the `Authorization` header, and without the localStorage token, there is nothing to send.
2. The current dual-auth creates confusion: middleware authenticates via cookie, API routes authenticate via Bearer header backed by localStorage.

**Recommendation:** Update `requireAuth` to check both the cookie and the Bearer header:

```typescript
export async function requireAuth(request: NextRequest): Promise<NextResponse | null> {
  const cookieToken = request.cookies.get("spool_tracker_token")?.value;
  const bearerToken = extractBearerToken(request.headers.get("Authorization"));
  const token = cookieToken || bearerToken;
  if (!token || !(await verifyToken(token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
```

---

## High Severity Issues

### H-1. CSP Allows `'unsafe-inline'` and `'unsafe-eval'` for Scripts

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/next.config.ts`
**Lines:** 11

```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
```

**Description:** Including both `'unsafe-inline'` and `'unsafe-eval'` in `script-src` effectively nullifies CSP protection against XSS. Any injected script will execute because inline scripts are allowed and `eval()` is permitted. While Next.js does require `'unsafe-eval'` in development mode, `'unsafe-inline'` combined with `'unsafe-eval'` in production is not meaningfully different from having no CSP at all for script protection.

**Recommendation:** For production, use nonce-based CSP or at minimum use `'unsafe-eval'` only (required by Next.js in some configurations) without `'unsafe-inline'`. Next.js 16 supports `nonce` configuration for scripts. Consider making CSP environment-aware:

```typescript
const isDev = process.env.NODE_ENV === "development";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-eval'"; // or use nonce-based approach
```

---

### H-2. Rate Limiter Uses In-Memory Map Without Size Bounds

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/auth/login/route.ts`
**Lines:** 8, 10-19

```typescript
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}
```

**Description:** The `attempts` Map grows unboundedly. While the `setInterval` cleanup runs every 5 minutes, an attacker performing a distributed attack from many different IPs can exhaust memory before cleanup runs. Each entry takes approximately 100-200 bytes. A flood from 10 million unique IPs (feasible via botnet or IPv6 spoofing) would consume ~1-2 GB before the next cleanup cycle.

**Recommendation:** Add a maximum size cap to the Map. When the cap is reached, either reject new entries or evict the oldest:

```typescript
const MAX_TRACKED_IPS = 100_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    if (attempts.size >= MAX_TRACKED_IPS && !entry) {
      // Under heavy attack; fail closed
      return true;
    }
    attempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}
```

---

### H-3. Rate Limiting Trusts X-Forwarded-For Header Without Validation

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/auth/login/route.ts`
**Lines:** 21-27

```typescript
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
```

**Description:** The `X-Forwarded-For` header can be spoofed by any client when the app is accessed directly (not behind a trusted reverse proxy). An attacker can bypass rate limiting by rotating the `X-Forwarded-For` value on each request:

```
X-Forwarded-For: 1.2.3.4
X-Forwarded-For: 1.2.3.5
X-Forwarded-For: 1.2.3.6
...
```

Each request appears to come from a different IP, so the rate limiter never reaches `MAX_ATTEMPTS` for any single key.

**Recommendation:** Either:
1. Only trust `X-Forwarded-For` when running behind a known proxy (check an environment variable like `TRUST_PROXY=true`).
2. Or use Next.js's built-in `request.ip` which may use the connection's remote address directly.
3. At minimum, document that this application MUST be deployed behind a reverse proxy for rate limiting to be effective.

---

### H-4. Metadata Field Bypass via `allowedFields` Whitelist

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/spools/[id]/route.ts`
**Lines:** 35-47

```typescript
const allowedFields = ["location_id", "status"];
const data: Record<string, unknown> = {};
for (const key of allowedFields) {
  if (key in body) data[key] = body[key];
}
// Validate metadata size (S-M4)
if ("metadata" in body) {
  const meta = typeof body.metadata === "string" ? body.metadata : JSON.stringify(body.metadata ?? "");
  if (meta.length > 10000) {
    return NextResponse.json({ error: "metadata 不能超过 10KB" }, { status: 400 });
  }
  data.metadata = meta;
}
```

**Description:** The `status` field is included in `allowedFields` without validation. Any arbitrary string can be set as a spool's status. The application UI expects exactly `"ACTIVE"` or `"EMPTY"`, but the API permits `"HACKED"`, `""`, `"DROP TABLE spools"`, etc. While Prisma prevents SQL injection, storing unexpected status values will break the UI and corrupt data semantics.

**Recommendation:** Validate the status value against an explicit enum:

```typescript
const VALID_STATUSES = ["ACTIVE", "EMPTY"] as const;

if ("status" in body) {
  if (!VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "无效的状态值" }, { status: 400 });
  }
  data.status = body.status;
}
```

---

### H-5. `location_id` Not Validated Before Database Write

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/spools/[id]/route.ts`
**Lines:** 35-39

```typescript
const allowedFields = ["location_id", "status"];
const data: Record<string, unknown> = {};
for (const key of allowedFields) {
  if (key in body) data[key] = body[key];
}
```

**Description:** `location_id` is passed directly to Prisma without any type or existence validation. While Prisma's foreign key constraint will throw an error if the location does not exist, the error is caught by the generic `catch` block on line 59 and returns a vague "更新失败" (update failed) message. The user gets no indication that the location ID was invalid. Additionally, a non-string value (number, object, array) could be passed as `location_id`.

**Recommendation:** Validate `location_id` is a string and optionally check it exists before updating:

```typescript
if ("location_id" in body) {
  if (body.location_id !== null && typeof body.location_id !== "string") {
    return NextResponse.json({ error: "无效的位置 ID" }, { status: 400 });
  }
  data.location_id = body.location_id;
}
```

---

### H-6. Catalog POST Allows Arbitrary Values for Optional Fields

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/catalog/route.ts`
**Lines:** 284-286

```typescript
for (const f of FILAMENT_OPTIONAL_FIELDS) {
  if (body[f]) data[f] = body[f];
}
```

**Description:** The `FILAMENT_OPTIONAL_FIELDS` list contains 31 fields. Every field value is stored directly without any type checking or sanitization. Since the database schema stores these as strings, non-string values will be coerced via Prisma, but there is no length validation. A malicious user could store extremely large values in any of these fields (e.g., a 100MB string in `color_hex`), effectively using the API as unlimited storage or causing denial-of-service via database bloat.

**Recommendation:** Add basic type and length validation:

```typescript
for (const f of FILAMENT_OPTIONAL_FIELDS) {
  if (body[f]) {
    const val = String(body[f]);
    if (val.length > 500) {
      return NextResponse.json({ error: `字段 ${f} 长度超出限制` }, { status: 400 });
    }
    data[f] = val;
  }
}
```

---

### H-7. `getCookieToken` Reads HttpOnly Cookie (Which Is Inaccessible)

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/lib/fetch.ts`
**Lines:** 6-9

```typescript
function getCookieToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)spool_tracker_token=([^;]*)/);
  return match?.[1] ?? null;
}
```

**Description:** The `spool_tracker_token` cookie is set with the `HttpOnly` flag (login route, line 67). HttpOnly cookies are deliberately inaccessible to JavaScript via `document.cookie`. This function will always return `null` for the HttpOnly cookie. The code then falls through to `getToken()` which reads from `localStorage`. This means:

1. `getCookieToken()` is dead code that provides false confidence.
2. The actual auth token flow relies entirely on `localStorage`, negating the HttpOnly security improvement.
3. The `credentials: "same-origin"` on line 21 does send the HttpOnly cookie with the request, but since `api-auth.ts` only checks the `Authorization` header (see C-2), the cookie is ignored.

**Recommendation:** Remove `getCookieToken()` since it cannot work with HttpOnly cookies. After fixing C-1 and C-2, the auth flow should be: browser automatically sends HttpOnly cookie via `credentials: "same-origin"`, and `requireAuth` reads it from `request.cookies`.

---

## Medium Severity Issues

### M-1. `setInterval` Runs at Module Level in Edge/Serverless Context

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/auth/login/route.ts`
**Lines:** 30-35

```typescript
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(ip);
  }
}, 5 * 60 * 1000).unref?.();
```

**Description:** This `setInterval` runs at module scope. In serverless or edge deployments (Vercel, etc.), the function instance may be frozen/unfrozen, and the interval timer may not behave as expected. The `.unref?.()` call suggests awareness of this, but in serverless contexts the Map itself is ephemeral -- each cold start creates a new empty Map, making the rate limiter ineffective across cold starts. The `setInterval` also prevents graceful shutdown in long-running Node.js processes unless `.unref()` succeeds.

**Recommendation:** Document that this rate limiter is only effective for single-process deployments. For production serverless deployments, consider using an external store (Redis, Upstash) or Vercel's rate limiting middleware. The current approach is acceptable for the Docker/standalone deployment described in the docs, but the limitation should be documented.

---

### M-2. No Error Handling for Failed Spool Fetch on Spools Page

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/spools/page.tsx`
**Lines:** 296-318

```typescript
async function loadActive() {
  setLoadingActive(true);
  try {
    const params = new URLSearchParams({
      status: "ACTIVE",
      sortBy: activeSortBy,
      sortOrder: activeSortOrder,
    });
    const data = await apiFetch<Spool[]>(`/api/spools?${params.toString()}`);
    if (!cancelled) {
      setActiveSpools(data);
    }
  } finally {
    if (!cancelled) {
      setLoadingActive(false);
    }
  }
}
```

**Description:** The `loadActive` and `loadEmpty` functions catch no errors. If `apiFetch` throws (e.g., network failure, non-401 HTTP error), the `finally` block sets loading to false, but the user sees an empty list with no indication that an error occurred. The same pattern exists for `loadEmpty`. Compare this with the locations page (`/src/app/locations/page.tsx` line 27) which properly captures and displays errors.

**Recommendation:** Add error state handling consistent with the locations page:

```typescript
const [errorActive, setErrorActive] = useState<string | null>(null);

async function loadActive() {
  setLoadingActive(true);
  setErrorActive(null);
  try {
    // ... existing fetch logic
  } catch (err) {
    if (!cancelled) {
      setErrorActive(err instanceof Error ? err.message : "加载失败");
    }
  } finally {
    if (!cancelled) setLoadingActive(false);
  }
}
```

---

### M-3. Brand Page Fetch Does Not Cancel In-Flight Requests on Re-render

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/catalog/brand/[brand]/page.tsx`
**Lines:** 50-66

```typescript
useEffect(() => {
  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        brand,
        sortBy,
        sortOrder,
      });
      const data = await apiFetch<CatalogItem[]>(`/api/catalog?${params.toString()}`);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }
  load();
}, [brand, sortBy, sortOrder]);
```

**Description:** Unlike the spools page which uses a `cancelled` flag to prevent stale state updates, the brand detail page has no cancellation mechanism. When the sort field or order changes rapidly, multiple fetches run concurrently, and the last one to resolve "wins" regardless of which request was initiated last. This is a classic React race condition. Also, no error handling is present (same as M-2).

**Recommendation:** Add a `cancelled` flag and error state:

```typescript
useEffect(() => {
  let cancelled = false;
  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ brand, sortBy, sortOrder });
      const data = await apiFetch<CatalogItem[]>(`/api/catalog?${params.toString()}`);
      if (!cancelled) setItems(data);
    } catch (err) {
      if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      if (!cancelled) setLoading(false);
    }
  }
  load();
  return () => { cancelled = true; };
}, [brand, sortBy, sortOrder]);
```

---

### M-4. Bulk AMS Creates Slots Sequentially Without Transaction

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/locations/bulk-ams/page.tsx`
**Lines:** 43-61

```typescript
try {
  let done = 0;
  for (let i = 0; i < selectedSlots.length; i++) {
    if (!selectedSlots[i]) continue;
    await apiFetch("/api/locations", {
      method: "POST",
      body: JSON.stringify({ /* ... */ }),
    });
    done++;
    setProgress(done);
  }
  router.push("/locations");
} catch (err) {
  setError(err instanceof Error ? err.message : "创建失败");
  setSaving(false);
}
```

**Description:** If the third API call fails, the first two slots have already been created. The user sees an error, but now has partial data. On retry, they may get duplicate slots (no uniqueness constraint apparent for `printer_name + ams_unit + ams_slot`). Additionally, `setSaving(false)` is missing from the success path (though `router.push` navigates away, the component may briefly render in a saving state).

**Recommendation:** Either:
1. Create a bulk API endpoint (`POST /api/locations/bulk`) that handles all slots in a single database transaction.
2. Or at minimum, track which slots were already created and skip them on retry, and add a note to the user about partial creation on error.

---

### M-5. Metadata Size Check Uses Character Length, Not Byte Length

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/spools/[id]/route.ts`
**Lines:** 42-43

```typescript
const meta = typeof body.metadata === "string" ? body.metadata : JSON.stringify(body.metadata ?? "");
if (meta.length > 10000) {
```

**Description:** The comment says "10KB limit" but `meta.length` measures JavaScript string characters, not bytes. A string of 10,000 CJK characters is approximately 30KB in UTF-8. The validation comment says 10KB but the code enforces 10,000 characters.

**Recommendation:** If the intent is 10KB in storage, use `new TextEncoder().encode(meta).byteLength > 10240` for accurate byte measurement. If the intent is 10,000 characters, update the error message to say "10000 字符" instead of "10KB".

---

### M-6. `SortHeader` Component Defined Inside Render Function

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/catalog/brand/[brand]/page.tsx`
**Lines:** 98-112

```typescript
function SortHeader({ field, label }: { field: SortField; label: string }) {
  const isActive = sortBy === field;
  const Icon = !isActive ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
    >
      <span>{label}</span>
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
```

**Description:** `SortHeader` is defined inside the `BrandDetailPage` component function. This means it is recreated on every render, which prevents React from reusing its instances (reconciliation treats it as a new component type each time). This causes unnecessary unmounting/remounting of every `SortHeader` on each re-render, and prevents any memoization from working. The spools page correctly defines `SortHeader` at the module level (line 35).

**Recommendation:** Move `SortHeader` outside `BrandDetailPage`, passing `sortBy`, `sortOrder`, and `onToggle` as props, matching the pattern used in `src/app/spools/page.tsx`.

---

### M-7. Location Form Submits `printer_name` as `name` for AMS Slots

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/components/LocationForm.tsx`
**Lines:** 51-59

```typescript
const isAms = values.type === "ams_slot";
const body = {
  name: isAms ? values.printer_name : values.name,
  type: values.type,
  is_default: values.is_default,
  printer_name: isAms ? values.printer_name : undefined,
  ams_unit: isAms ? values.ams_unit : undefined,
  ams_slot: isAms ? values.ams_slot : undefined,
};
```

**Description:** For AMS slots, `name` is set to the same value as `printer_name`. This means if you have a printer "X1C" with 4 AMS slots, all 4 locations will have the same `name` value "X1C". The locations list will show four identical entries. It would be more useful to compose a descriptive name like `${printer_name} AMS${ams_unit}-${ams_slot}`.

**Recommendation:** Generate a descriptive name for AMS slots:

```typescript
name: isAms
  ? `${values.printer_name.trim()} AMS${values.ams_unit.trim()}-${values.ams_slot.trim()}`
  : values.name,
```

---

### M-8. Missing `type="button"` on Back Navigation Button

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/catalog/brand/[brand]/page.tsx`
**Line:** 117

```typescript
<button onClick={() => router.back()} className="text-muted-foreground">
```

**Description:** This `<button>` element has no `type` attribute. Inside a `<form>`, the default type is `"submit"`. While this button is not inside a form in this particular component, it is a best practice to always specify `type="button"` for buttons that are not form submitters. The same issue exists in `/src/app/locations/bulk-ams/page.tsx` line 71.

**Recommendation:** Add `type="button"` to both back navigation buttons.

---

### M-9. `safeEqual` in Login Route Uses Node.js `crypto`, Not Web Crypto

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/auth/login/route.ts`
**Lines:** 2, 78-87

```typescript
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
```

**Description:** While `auth.ts` uses Web Crypto for Edge compatibility, the login route imports `timingSafeEqual` from Node.js `crypto` and uses `Buffer`. If the login route is ever configured to run in Edge Runtime (e.g., via `export const runtime = 'edge'`), this will fail. The inconsistency between `auth.ts` (Web Crypto, Edge-safe) and `login/route.ts` (Node.js crypto) is confusing for future maintainers.

**Recommendation:** This is acceptable if the login route is guaranteed to run in Node.js runtime (the default for API routes). Add a comment documenting this assumption, or align with the Web Crypto approach used in `auth.ts` for consistency.

---

### M-10. Catalog Route Fetches All Records for Brand Aggregation

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/catalog/route.ts`
**Lines:** 64-78 (brandList), 83-136 (brand grouping), 140-186 (material grouping)

```typescript
if (groupBy === "brandList") {
  const items = await prisma.globalFilament.findMany({
    select: { brand: true, logo_url: true },
  });
  // ... in-memory aggregation
```

**Description:** Three separate grouping modes (`brandList`, `brand`, `material`) all fetch every record from the `globalFilament` table and aggregate in JavaScript memory. For small datasets this is fine, but as the catalog grows (hundreds or thousands of filament entries), this performs unnecessary work. Prisma supports `groupBy` for aggregation at the database level.

**Recommendation:** For SQLite with small datasets this is acceptable, but consider using Prisma's `groupBy` or raw SQL aggregation if the catalog grows beyond ~1000 entries. Add a comment noting the trade-off.

---

### M-11. Logo Download Directory Created Once With Module-Level Flag

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/upload/logo/route.ts`
**Lines:** 15, 44-47

```typescript
let logosDirReady = false;

// ...
if (!logosDirReady) {
  await mkdir(logosDir, { recursive: true });
  logosDirReady = true;
}
```

**Description:** The `logosDirReady` flag is module-scoped. In serverless environments, each cold start resets this flag. In long-running processes, the flag is set once and never checked again. If the `data/logos` directory is deleted while the process runs (e.g., by an admin cleanup), subsequent uploads will fail without a clear error. The `mkdir` with `{ recursive: true }` is idempotent, so the flag saves minimal overhead.

**Recommendation:** Since `mkdir` with `{ recursive: true }` is a no-op if the directory exists, it is safe and cleaner to call it on every upload request, removing the flag entirely:

```typescript
await mkdir(logosDir, { recursive: true });
```

---

### M-12. SVG Still Rendered in Browser as Content-Type `image/svg+xml`

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/logos/[filename]/route.ts`
**Lines:** 37-40

```typescript
if (ext === "svg") {
  headers["Content-Disposition"] = `attachment; filename="${safe}"`;
  headers["X-Content-Type-Options"] = "nosniff";
}
```

**Description:** The `Content-Disposition: attachment` header forces a download, which is a reasonable mitigation for stored XSS via SVG. However, the `Content-Type` is still set to `image/svg+xml` on line 32 (via `MIME_MAP`). Some older browsers or misconfigured proxies may ignore `Content-Disposition` and render the SVG inline. A more defensive approach would be to serve SVGs as `application/octet-stream`.

**Recommendation:** Override the Content-Type for SVG files:

```typescript
if (ext === "svg") {
  headers["Content-Type"] = "application/octet-stream";
  headers["Content-Disposition"] = `attachment; filename="${safe}"`;
  headers["X-Content-Type-Options"] = "nosniff";
}
```

---

## Low Severity Issues

### L-1. Duplicate `parseSortOrder` Function

**Files:**
- `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/spools/route.ts` lines 25-27
- `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/catalog/route.ts` lines 24-26

```typescript
function parseSortOrder(value: string | null): Prisma.SortOrder {
  return value === "asc" ? "asc" : "desc";
}
```

**Description:** Identical `parseSortOrder` functions are defined in both API route files.

**Recommendation:** Extract to a shared utility, e.g., `src/lib/sort-utils.ts`.

---

### L-2. `SortField` and `SortOrder` Types Duplicated Between Client and Server

**Files:**
- Client: `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/spools/page.tsx` lines 28-29
- Server: `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/api/spools/route.ts` lines 6-16

**Description:** Sort field enums are defined separately on client and server. If a new sort field is added on the server, the client type may not be updated, or vice versa.

**Recommendation:** Share sort field constants from a common module (e.g., `src/lib/spool-types.ts`).

---

### L-3. `alert()` Used for Error Feedback in Spools Page

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/spools/page.tsx`
**Lines:** 358, 370

```typescript
alert(error instanceof Error ? error.message : "重新入库失败，请重试");
alert(error instanceof Error ? error.message : "删除失败，请重试");
```

**Description:** Native `alert()` dialogs provide poor UX on mobile devices and cannot be styled. They block the main thread.

**Recommendation:** Use a toast notification component or an inline error message, consistent with the error display patterns used elsewhere in the app (e.g., `setError`).

---

### L-4. `window.confirm()` Used for Delete Confirmation

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/spools/page.tsx`
**Line:** 363

```typescript
if (!window.confirm("确认删除此空卷轴？此操作不可撤销。")) {
```

**Description:** Same UX concern as L-3. `window.confirm()` is not styleable.

**Recommendation:** Consider a custom confirmation dialog component for consistency.

---

### L-5. Inconsistent Error Message Language

**Files:** Multiple

**Description:** Error messages mix Chinese and English. For example:
- `"Unauthorized"` in `api-auth.ts` (English)
- `"密码错误"` in login route (Chinese)
- `"materialType parameter required"` in catalog route (English)

**Recommendation:** Standardize on one language for all API error messages. Since the UI is in Chinese, using Chinese for user-facing errors and English for system/internal errors is acceptable, but be consistent.

---

### L-6. `getSwatchColor` Returns Hardcoded Gray Fallback

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/catalog/brand/[brand]/page.tsx`
**Lines:** 36-39

```typescript
function getSwatchColor(value?: string | null): string {
  const normalized = normalizeHex(value);
  return normalized === "--" ? "#e5e7eb" : normalized;
}
```

**Description:** The fallback gray `#e5e7eb` is a hardcoded Tailwind gray-200 value. If the theme changes, this color may not match.

**Recommendation:** Use a CSS variable or Tailwind class reference instead, or accept this as a minor consistency issue.

---

### L-7. Missing `aria-label` on Sort Header Buttons

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/spools/page.tsx`
**Lines:** 52-60

```typescript
<button
  type="button"
  onClick={() => onToggle(field)}
  className="inline-flex items-center gap-1.5 ..."
>
```

**Description:** Sort header buttons have visible labels but no `aria-label` indicating their current sort state. Screen readers will read the label text but not know the current sort direction or that the button toggles sorting.

**Recommendation:** Add `aria-label` or `aria-sort` to convey sort state to assistive technologies:

```typescript
aria-label={`Sort by ${label}, currently ${isActive ? sortOrder : 'unsorted'}`}
```

---

### L-8. `useParams` Type Assertion May Return Array

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/src/app/catalog/brand/[brand]/page.tsx`
**Line:** 42

```typescript
const { brand: encodedBrand } = useParams<{ brand: string }>();
```

**Description:** In Next.js, `useParams()` can return `string | string[]` for dynamic segments when catch-all routes are involved. The generic type parameter provides TypeScript narrowing, but at runtime, if the route configuration changes, `encodedBrand` could be an array. `decodeURIComponent` called on an array returns unexpected results.

**Recommendation:** Add a runtime guard:

```typescript
const rawBrand = useParams<{ brand: string }>().brand;
const brand = decodeURIComponent(Array.isArray(rawBrand) ? rawBrand[0] : rawBrand);
```

---

### L-9. Dockerfile Copies Entire `prisma` Node Module Directory

**File:** `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager/Dockerfile`
**Lines:** 33-35

```dockerfile
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
```

**Description:** The `prisma` npm package includes query engines for all platforms and the Prisma Studio web UI, totaling ~50-100MB. In the production image, only the migration engine and the generated client are needed.

**Recommendation:** This is acceptable for simplicity. For image size optimization, you could copy only the required binaries:

```dockerfile
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/prisma/build ./node_modules/prisma/build
COPY --from=builder /app/node_modules/prisma/package.json ./node_modules/prisma/package.json
```

---

## Positive Observations

The following aspects of the codebase are well-implemented:

1. **Open redirect prevention** in both `middleware.ts` (line 28) and `login/page.tsx` (`sanitizeRedirect` function) correctly blocks `//evil.com` style attacks.

2. **Constant-time token verification** via Web Crypto `verify` in `auth.ts` is the correct approach for HMAC comparison, avoiding timing side-channel attacks.

3. **Edge-compatible auth** with Web Crypto API and dynamic `require("crypto")` for the Node.js path is a thoughtful approach for Next.js middleware compatibility.

4. **SVG upload blocking** in the logo upload route eliminates the primary stored XSS vector.

5. **Path traversal prevention** using `basename()` in the logo serving route is correct and simple.

6. **Prisma error code handling** in catalog DELETE (`P2003`, `P2025`) provides meaningful error messages instead of generic failures.

7. **Sort field whitelisting** prevents SQL injection via sort parameter manipulation, which is a commonly overlooked attack vector.

8. **Prisma client caching** in `db.ts` across all environments prevents connection exhaustion.

9. **Dockerfile avoids `npx`** in the CMD, preventing network dependency at container startup.

10. **Cancellation pattern** in spools page `useEffect` hooks correctly prevents stale state updates after unmount.

---

## Prioritized Recommendations

### Immediate (before merge)

1. **Fix the HttpOnly cookie + localStorage dual-auth architecture** (C-1, C-2, H-7). Either complete the HttpOnly migration or remove the HttpOnly cookie and keep localStorage. The current hybrid approach provides the security of neither while adding complexity.

2. **Validate `status` field in spool PATCH** (H-4). This is a simple fix that prevents data corruption.

3. **Add error state to spools page** (M-2). Users currently see empty lists on network errors with no feedback.

4. **Add cancellation to brand page useEffect** (M-3). This is a straightforward race condition fix.

### Short-term (next sprint)

5. **Cap the rate limiter Map size** (H-2). Prevents memory exhaustion under attack.

6. **Validate optional field lengths in catalog POST** (H-6). Prevents storage abuse.

7. **Fix SortHeader defined inside render** (M-6). Free performance improvement.

8. **Generate descriptive AMS slot names** (M-7). Improves UX for multi-slot users.

### Long-term (backlog)

9. **Tighten CSP** (H-1). Remove `'unsafe-inline'` from script-src when Next.js nonce support is configured.

10. **Add bulk AMS endpoint** (M-4). Prevents partial creation failures.

11. **Shared sort utilities** (L-1, L-2). Reduces duplication.

12. **Replace `alert()` / `confirm()` with custom UI** (L-3, L-4). Improves mobile UX.
