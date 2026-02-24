# Code Quality Review — 3d-filament-manager

**Reviewer:** Claude
**Date:** 2026-02-23
**Scope:** Full codebase (Next.js 15 App Router, Prisma/SQLite, Tailwind/shadcn)

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 8     |
| Medium   | 10    |
| Low      | 6     |

---

## Critical

### C1. In-Memory Token Store Does Not Survive Deployments or Multi-Instance Scaling

**File:** `src/lib/auth.ts` (lines 5–14)
**Category:** Security / Technical Debt

The token store is a `Map` held in Node.js process memory. In any multi-instance deployment (PM2 cluster, Kubernetes pods, serverless) tokens issued by one instance are invisible to others, causing random 401s. A server restart also invalidates every active session.

```ts
// Current — process-scoped Map
const tokenStore: Map<string, number> = global.__spoolTokenStore;
```

**Recommendation:** Use a signed JWT (e.g. `jose`) or store tokens in the SQLite database. JWT eliminates the need for server-side state entirely:

```ts
import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.APP_SECRET);

export async function generateToken(): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}
```

---

### C2. Middleware Only Checks Cookie Existence, Not Validity

**File:** `src/proxy.ts` (lines 17–32)
**Category:** Security

The middleware (Edge Runtime) only checks whether the `spool_tracker_token` cookie exists — it never validates the token. Any non-empty cookie value bypasses the middleware redirect, granting access to all page routes.

```ts
// Current — any truthy cookie passes
const token = request.cookies.get("spool_tracker_token")?.value;
if (!token) { /* redirect */ }
// ← no verification of token value
```

**Recommendation:** If switching to JWT (see C1), verify the signature in the middleware. If keeping the current scheme, at minimum forward the token to an internal validation endpoint or use `jose` in Edge Runtime:

```ts
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.APP_SECRET);

export async function proxy(request: NextRequest) {
  // ... public path checks ...
  const token = request.cookies.get("spool_tracker_token")?.value;
  if (!token) { /* redirect */ }
  try {
    await jwtVerify(token, secret);
  } catch {
    // invalid/expired — clear cookie and redirect
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete("spool_tracker_token");
    return res;
  }
  return NextResponse.next();
}
```

---

### C3. Password Comparison Is Timing-Attack Vulnerable

**File:** `src/app/api/auth/login/route.ts` (line 8)
**Category:** Security

```ts
if (!password || password !== process.env.APP_PASSWORD) {
```

Direct `!==` comparison leaks timing information. Use `crypto.timingSafeEqual`:

```ts
import { timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

---

## High

### H1. `allowedFields` List Duplicated Across Files

**Files:**
- `src/app/api/catalog/route.ts` (lines 230–241)
- `src/app/api/catalog/[id]/route.ts` (lines 39–50)
- `src/components/CatalogForm.tsx` (lines 250–261)

The same ~30-field list of optional filament fields is copy-pasted in three places. Adding a new field requires synchronized edits in all three — a guaranteed source of drift bugs.

**Recommendation:** Extract a single source of truth:

```ts
// src/lib/filament-fields.ts
export const OPTIONAL_FILAMENT_FIELDS = [
  "color_hex", "nozzle_temp", "bed_temp", "print_speed", "logo_url",
  "density", "diameter", "nominal_weight", /* ... */
] as const;

export type OptionalFilamentField = typeof OPTIONAL_FILAMENT_FIELDS[number];
```

Then import and use in all three locations.

---

### H2. Catalog GET Handler Has Excessive Cyclomatic Complexity

**File:** `src/app/api/catalog/route.ts` (lines 5–215)
**Category:** Code Complexity

The single `GET` function handles 5 distinct `groupBy` modes (`brandList`, `brand`, `material`, `materialType`, flat list) in one 210-line function with deeply nested `if` chains. Cyclomatic complexity is ~12.

**Recommendation:** Extract each mode into its own handler function:

```ts
const GROUP_HANDLERS: Record<string, (req: NextRequest) => Promise<NextResponse>> = {
  brandList: handleBrandList,
  brand: handleBrandGroup,
  material: handleMaterialGroup,
  materialType: handleMaterialTypeGroup,
};

export async function GET(request: NextRequest) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const groupBy = new URL(request.url).searchParams.get("groupBy");
  const handler = groupBy ? GROUP_HANDLERS[groupBy] : handleFlatList;
  if (!handler) return NextResponse.json({ error: "Invalid groupBy" }, { status: 400 });
  return handler(request);
}
```

---

### H3. POST Catalog Manually Enumerates Every Field in `prisma.create`

**File:** `src/app/api/catalog/route.ts` (lines 254–295)
**Category:** Maintainability / Duplication

The `POST` handler builds a `data` record from `optionalFields`, then manually lists every single field again in the `prisma.create` call. This is redundant — the `data` object can be passed directly:

```ts
// Instead of 40 lines of data.brand, data.material, ...
const item = await prisma.globalFilament.create({ data });
```

---

### H4. `ParamSection` / `SpoolParamSection` Are Identical Components

**Files:**
- `src/app/catalog/[id]/page.tsx` (lines 67–83) — `ParamSection`
- `src/app/spool/[id]/page.tsx` (lines 62–78) — `SpoolParamSection`

These are character-for-character identical. Extract to a shared component:

```ts
// src/components/ParamSection.tsx
export function ParamSection({ title, items }: {
  title: string;
  items: { label: string; value?: string | null }[];
}) { /* ... */ }
```

---

### H5. Interface Types Duplicated Across Client Pages

**Files:**
- `CatalogDetail` in `src/app/catalog/[id]/page.tsx` (lines 12–65)
- `SpoolDetail.globalFilament` in `src/app/spool/[id]/page.tsx` (lines 18–58)
- `CatalogItem` in `src/app/catalog/brand/[brand]/page.tsx` (lines 9–17)
- `CatalogItem` in `src/app/catalog/material/[material]/page.tsx` (lines 9–17)

The `GlobalFilament` shape is redefined in at least 4 files. Any schema change requires hunting down every copy.

**Recommendation:** Create `src/types/models.ts` with shared interfaces generated from or aligned with the Prisma schema.

---

### H6. No Input Sanitization on `color_hex` — Potential XSS via `style` Attribute

**File:** `src/components/ColorSwatch.tsx` (line 13)
**Category:** Security

```tsx
style={colorHex ? { backgroundColor: colorHex } : { backgroundColor: "#e5e7eb" }}
```

The `colorHex` value comes from user input and is injected into a `style` prop. While React's `style` object is safer than raw HTML, a malformed value could still cause rendering issues. Validate the hex format:

```ts
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const safeBg = colorHex && HEX_RE.test(colorHex) ? colorHex : "#e5e7eb";
```

---

### H7. Race Condition in Default Location Toggle

**Files:**
- `src/app/api/locations/route.ts` (lines 44–49)
- `src/app/api/locations/[id]/route.ts` (lines 65–70)

Setting a location as default uses two separate queries (unset all, then set one) without a transaction. Concurrent requests can leave zero or multiple defaults.

```ts
// Current — not atomic
await prisma.location.updateMany({ where: { is_default: true }, data: { is_default: false } });
// ← another request could run here
```

**Recommendation:** Wrap in a Prisma transaction:

```ts
await prisma.$transaction([
  prisma.location.updateMany({ where: { is_default: true, id: { not: id } }, data: { is_default: false } }),
  prisma.location.update({ where: { id }, data: { is_default: true } }),
]);
```

---

### H8. `apiFetch` Hardcodes `Content-Type: application/json` for All Requests

**File:** `src/lib/fetch.ts` (line 14)
**Category:** Bug

```ts
headers: {
  "Content-Type": "application/json",
  ...(options.headers ?? {}),
},
```

This means `FormData` uploads (like logo upload) would break if routed through `apiFetch`, because `FormData` needs the browser to set the `Content-Type` with the boundary. The `CatalogForm` works around this by using raw `fetch` for uploads (line 207), but this is fragile and inconsistent.

**Recommendation:** Only set `Content-Type` when the body is a string:

```ts
const headers: Record<string, string> = {
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...(options.headers as Record<string, string> ?? {}),
};
if (typeof options.body === "string") {
  headers["Content-Type"] = "application/json";
}
```

---

## Medium

### M1. Inline SVG Icons Duplicated Everywhere

**Files:** Nearly every page component (back chevron, forward chevron, flask icon)

The same back-button SVG appears in at least 8 files:

```tsx
<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
</svg>
```

**Recommendation:** The project already uses `lucide-react`. Replace inline SVGs with `<ChevronLeft />`, `<ChevronRight />`, etc.

---

### M2. No Error Boundary for Client Pages

**Category:** Error Handling

All client pages use `try/finally` in their `useEffect` data loaders but have no React error boundary. An unhandled render-time error crashes the entire app to a white screen.

**Recommendation:** Add an `error.tsx` file in the app directory (Next.js convention) to catch and display errors gracefully.

---

### M3. `QRScanner` Has Unstable `onResult` Callback Dependency

**File:** `src/components/QRScanner.tsx` (line 45)

```tsx
useEffect(() => { /* ... */ }, [onResult]);
```

`onResult` is an inline function in the parent, so it changes on every render, causing the scanner to restart repeatedly. This will cause camera flicker.

**Recommendation:** Either `useCallback` the parent's `onResult`, or use a ref inside `QRScanner`:

```tsx
const onResultRef = useRef(onResult);
onResultRef.current = onResult;

useEffect(() => {
  // use onResultRef.current inside the callback
  // dependency array: [] (mount only)
}, []);
```

---

### M4. Location Delete Is Not Atomic

**File:** `src/app/api/locations/[id]/route.ts` (lines 100–107)

```ts
await prisma.spool.updateMany({ where: { location_id: id }, data: { location_id: null } });
await prisma.location.delete({ where: { id } });
```

If the delete fails after the spool update, spools lose their location reference with no way to recover. Wrap in `$transaction`.

---

### M5. `window.location.origin` Used in Client Components for QR URLs

**Files:**
- `src/app/location/[id]/page.tsx` (line 191)
- `src/app/spool/[id]/page.tsx` (line 343)

```tsx
qrUrl={`${window.location.origin}/spool/${id}`}
```

This breaks during SSR (window is undefined). It works here because these are `"use client"` components that only render after mount, but it's fragile. The server-rendered print pages correctly use `NEXT_PUBLIC_BASE_URL` instead.

**Recommendation:** Use `NEXT_PUBLIC_BASE_URL` consistently, or guard with a `useEffect`-based state.

---

### M6. Prisma Schema Uses `String` for Numeric Fields

**File:** `prisma/schema.prisma` (lines 17–19, 23–32, etc.)

Fields like `nozzle_temp`, `bed_temp`, `density`, `diameter`, `fan_min`, `fan_max` are all `String?`. This prevents any database-level validation, sorting, or range queries on numeric data.

**Recommendation:** For a future migration, consider using `Float?` or `Int?` for genuinely numeric fields, keeping `String?` only for fields that may contain units or ranges (e.g., "190-230°C").

---

### M7. `CatalogForm` Is 472 Lines — Too Large for a Single Component

**File:** `src/components/CatalogForm.tsx`
**Category:** Maintainability

This file contains the form state, brand selection logic, logo upload, material type dropdown, collapsible sections, and submission logic all in one component. It's the largest file in the project.

**Recommendation:** Extract:
- `BrandSelector` component
- `MaterialTypeSelector` component
- `LogoUploader` component
- Move `MATERIAL_PRESETS` to a constants file

---

### M8. `catch {}` Swallows Errors Silently in Multiple Places

**Files:**
- `src/app/spool/[id]/print/spool-label-printer.tsx` (lines 115, 121)
- `src/components/CatalogForm.tsx` (lines 180, 188)
- `src/components/QRScanner.tsx` (line 33)

Empty `catch {}` blocks hide failures completely. At minimum, log to console in development:

```ts
catch (err) {
  if (process.env.NODE_ENV === "development") console.error(err);
}
```

---

### M9. `spool-label-printer.tsx` Loads a Custom Font from a Hardcoded Relative Path

**File:** `src/app/spool/[id]/print/spool-label-printer.tsx` (lines 11–14)

```ts
const lxgwFont = localFont({
  src: "../../../../../fonts/LXGWNeoXiHeiScreenFull.ttf",
```

Five levels of `../` is brittle. If the file moves, the path breaks silently. Use a path alias:

```ts
src: "@/fonts/LXGWNeoXiHeiScreenFull.ttf",
```

(Note: `next/font/local` doesn't support aliases — consider moving the font to `public/fonts/` or using a shorter relative path by co-locating.)

---

### M10. `proxy.ts` Is Not Wired as Next.js Middleware

**File:** `src/proxy.ts`

The file exports `proxy` and `config` but Next.js middleware must be at `src/middleware.ts` (or `middleware.ts` at root). If this file is imported by a proper `middleware.ts`, that's fine — but the naming is misleading and the `config` export in this file is unused unless re-exported.

**Recommendation:** Rename to `src/middleware.ts` or verify it's properly re-exported from the actual middleware entry point.

---

## Low

### L1. `StatusBadge` Only Handles Two Statuses

**File:** `src/components/StatusBadge.tsx`

The component only handles `"ACTIVE"` and `"EMPTY"`. If a new status is added (e.g., `"DRYING"`), it silently renders the `"EMPTY"` badge. Add a default/unknown case.

---

### L2. `location-types.ts` Fallback Uses Magic Index

**File:** `src/lib/location-types.ts` (line 12)

```ts
return LOCATION_TYPES.find((t) => t.value === type) ?? LOCATION_TYPES[4]; // fallback to custom
```

`LOCATION_TYPES[4]` is a magic number. If the array order changes, this breaks. Use `.find()` for the fallback too:

```ts
?? LOCATION_TYPES.find((t) => t.value === "custom")!
```

---

### L3. `expiresAt` Calculated Independently in Login Route

**File:** `src/app/api/auth/login/route.ts` (line 13)

```ts
const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
```

This duplicates the `TOKEN_TTL` constant from `auth.ts`. If TTL changes in one place but not the other, the client will show incorrect expiry.

**Recommendation:** Export `TOKEN_TTL` from `auth.ts` and reuse it.

---

### L4. Login Page Cookie Lacks `Secure` Flag

**File:** `src/app/(auth)/login/page.tsx` (line 43)

```ts
document.cookie = `spool_tracker_token=${token}; path=/; max-age=${days * 24 * 3600}; SameSite=Lax`;
```

No `Secure` flag means the cookie is sent over HTTP too. For production HTTPS deployments, add `Secure`:

```ts
const secure = window.location.protocol === "https:" ? "; Secure" : "";
document.cookie = `spool_tracker_token=${token}; path=/; max-age=${days * 24 * 3600}; SameSite=Lax${secure}`;
```

---

### L5. `dangerouslySetInnerHTML` for Print Auto-Trigger

**File:** `src/app/location/[id]/print/page.tsx` (lines 108–112)

```tsx
<script dangerouslySetInnerHTML={{ __html: `window.addEventListener('load', () => window.print())` }} />
```

While the content is a static string (not user-controlled), `dangerouslySetInnerHTML` is a code smell. Use a client component with `useEffect` instead:

```tsx
"use client";
import { useEffect } from "react";
export function AutoPrint() {
  useEffect(() => { window.print(); }, []);
  return null;
}
```

---

### L6. `img` Tags Used Instead of `next/image` in Several Places

**Files:**
- `src/components/CatalogForm.tsx` (line 450)
- `src/app/catalog/page.tsx` (line 145)
- `src/app/spool/[id]/print/spool-label-printer.tsx` (line 267)

These use raw `<img>` tags, bypassing Next.js image optimization. For the SVG label renderer this is acceptable, but for the catalog page and form preview, `next/image` would be more appropriate.

---

## Architecture Notes (Non-Findings)

These are not issues but observations for future planning:

1. The project has no tests. As the codebase grows, adding at least API route integration tests would catch regressions early.
2. No rate limiting on the login endpoint — brute-force attacks are trivially easy.
3. The `data/logos/` directory is on the local filesystem. In a containerized deployment, uploaded logos are lost on container restart. Consider S3 or storing blobs in SQLite.
4. All API routes repeat the `requireAuth` boilerplate. A Next.js middleware-based approach or a wrapper function could reduce this.
