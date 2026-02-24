# Code Quality Review Report

## Summary Counts

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 2 |
| Medium   | 5 |
| Low      | 4 |

---

## High Severity

### H1: Rate limiter memory leak potential (login/route.ts)

**File:** `src/app/api/auth/login/route.ts`
**Lines:** 8-20, 28-33

The in-memory rate limiter uses `setInterval` for cleanup every 5 minutes, but the `attempts` Map grows unbounded between cleanups. In a targeted attack with many unique IPs, memory could grow significantly within the 5-minute window.

**Recommendation:** Add a max size check on the Map (e.g., 10,000 entries) and evict oldest entries when exceeded. For production, consider using a Redis-based rate limiter.

### H2: HttpOnly cookie readable by client-side code (fetch.ts)

**File:** `src/lib/fetch.ts`
**Lines:** 5-8

`getCookieToken()` attempts to read `spool_tracker_token` from `document.cookie`. However, the login route now sets this cookie as `HttpOnly`, which means `document.cookie` cannot access it. The cookie will be sent automatically via `credentials: "same-origin"`, so the Bearer header from cookie is redundant — but the fallback to localStorage still works.

**Recommendation:** Remove `getCookieToken()` function since HttpOnly cookies are not readable from JS. The cookie is sent automatically. Keep localStorage fallback for backward compatibility during transition.

---

## Medium Severity

### M1: CSP allows unsafe-inline and unsafe-eval (next.config.ts)

**File:** `next.config.ts`
**Lines:** 7-10

The Content-Security-Policy includes `'unsafe-inline'` and `'unsafe-eval'` for `script-src`. While necessary for Next.js to function (inline scripts, webpack eval in dev), this significantly weakens CSP protection against XSS.

**Recommendation:** Consider using nonce-based CSP for production. Next.js 14+ supports `nonce` via `headers()`. Document this as a known limitation.

### M2: Metadata validation inconsistency (spools/[id]/route.ts)

**File:** `src/app/api/spools/[id]/route.ts`
**Lines:** 35-41

The metadata validation stringifies objects but also accepts strings. If `body.metadata` is already a string, it's used directly. If it's an object, it's JSON-stringified. The `?? ""` fallback means `null` metadata becomes `""` (empty string) rather than being stored as null.

**Recommendation:** Normalize the handling — decide if metadata should always be a JSON string or allow null.

### M3: Catalog DELETE error message loses specificity (catalog/[id]/route.ts)

**File:** `src/app/api/catalog/[id]/route.ts`
**Lines:** 63-78

The old code returned the exact spool count (`该耗材关联了 ${spoolCount} 卷料卷`). The new code only says `该耗材关联了料卷，无法删除`. While the new approach is more efficient (single query vs count+delete), the user loses useful information.

**Recommendation:** Consider adding a count query in the P2003 catch block to provide the count in the error message.

### M4: Duplicate sort parsing logic (catalog/route.ts & spools/route.ts)

**File:** `src/app/api/catalog/route.ts`, `src/app/api/spools/route.ts`

Both files implement nearly identical `parseSortOrder()` functions and similar sort field validation patterns. This is minor duplication.

**Recommendation:** Could extract to a shared utility, but acceptable for now given the small scope.

### M5: Brand detail page SortHeader defined inside component (brand/[brand]/page.tsx)

**File:** `src/app/catalog/brand/[brand]/page.tsx`
**Lines:** ~95-110

`SortHeader` is defined as a function inside the `BrandDetailPage` component. This means it's recreated on every render. While React handles this fine for simple cases, it's not ideal.

**Recommendation:** Move `SortHeader` outside the component or memoize it.

---

## Low Severity

### L1: Unused `logo_url` in spools API response (spools/route.ts)

**File:** `src/app/api/spools/route.ts`
**Line:** ~70

The spools GET response includes `logo_url` in the globalFilament select, but the spools page UI doesn't display logos.

### L2: `logosDirReady` flag is process-global (upload/logo/route.ts)

**File:** `src/app/api/upload/logo/route.ts`
**Line:** 14

The `logosDirReady` flag avoids repeated `mkdir` calls, which is a nice optimization. However, if the directory is deleted while the process is running, uploads will fail silently.

### L3: Hardcoded Chinese strings throughout API routes

Multiple API route files contain hardcoded Chinese error messages. Consider using a constants file for i18n readiness, though this is acceptable for a personal project.

### L4: `window.confirm` and `alert` usage (spools/page.tsx)

**File:** `src/app/spools/page.tsx`
**Lines:** ~290, ~300

Using `window.confirm` and `alert` for delete confirmation and error display. Works but not consistent with the shadcn/ui design system.

---

## Positive Observations

1. **Security improvements are well-implemented** — rate limiting, HttpOnly cookies, open redirect prevention, constant-time HMAC verification are all solid.
2. **Sort field whitelisting** prevents SQL injection through sort parameters.
3. **SVG upload removal** is the right call for a small project without SVG sanitization.
4. **Prisma error code handling** in catalog DELETE is more robust than pre-count approach.
5. **Dockerfile optimization** avoiding npx network fetch is a good production practice.
6. **Cancellation pattern** in spools page useEffect with `cancelled` flag is correct React practice.
