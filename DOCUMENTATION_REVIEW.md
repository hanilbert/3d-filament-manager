# Documentation Review — 3D Filament Manager (Spool Tracker)

**Reviewer**: Technical Documentation Architect
**Date**: 2026-02-23
**Scope**: Full codebase — Next.js 16 App Router, Prisma/SQLite, Tailwind CSS v4, shadcn/ui
**Project root**: `/Users/hta/Old_Youth/05_Project_Code/3d-filament-manager`

---

## Executive Summary

The project has a solid documentation foundation: a bilingual README, a detailed PRD (`docs/PRD.md`), an architecture document (`docs/ARCHITECTURE.md`), a deployment guide (`docs/DEPLOYMENT.md`), and a comprehensive test-case catalogue (`docs/TEST-CASES.md`). However, several **accuracy gaps** between the docs and the actual code, missing inline documentation on security-critical logic, and the complete absence of API request/response schemas create real risks for maintainers and future contributors.

---

## Findings

---

### F-01 — README states "Next.js 16" but `package.json` confirms it too; however README also says "React 19 runtime" — version table is internally consistent but misleading

**Severity**: Low
**Location**: `README.md` line 28 (`Next.js 16`), line 29 (`React 19`)
**Finding**: The tech-stack table in the README lists the framework as "Next.js 16（App Router）" and the runtime as "React 19". `package.json` confirms `"next": "16.1.6"` and `"react": "19.2.3"`. This is accurate. However, the README header says "Next.js 15 App Router" in the prior-phase context supplied to this review, which is inconsistent with the actual installed version. The README itself is internally consistent but should be verified against the intended release target.
**Recommendation**: Add a single "Versions" badge row at the top of the README (e.g., `Next.js 16.1.6 | React 19.2.3 | Prisma 6.x | Node 20+`) so the version story is unambiguous at a glance.

---

### F-02 — README tech-stack table lists "Tailwind CSS v4" but omits shadcn/ui version

**Severity**: Low
**Location**: `README.md` line 29
**Finding**: The table lists "Tailwind CSS v4 + shadcn/ui + Lucide React" without version pins. `package.json` shows `"tailwindcss": "^4"` and `"shadcn": "^3.8.5"`. The shadcn version matters because the component API changed significantly between v2 and v3.
**Recommendation**: Pin the shadcn version in the tech-stack table and note that `components.json` governs the component registry configuration.

---

### F-03 — No `.env.example` file exists in the repository

**Severity**: High
**Location**: `README.md` line 50 (`cp .env.example .env`), `docs/DEPLOYMENT.md` line 42
**Finding**: Both the README and the deployment guide instruct users to run `cp .env.example .env`, but no `.env.example` file is present in the project root. A new developer following the quick-start guide will hit an immediate error.
**Recommendation**: Create `.env.example` with all four documented variables, safe placeholder values, and inline comments:

```env
# Required: single-password access control
APP_PASSWORD=change_me_before_deploy

# Required: base URL used to generate QR code links
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Required: SQLite database path (must match Docker volume mount)
DATABASE_URL=file:./data/dev.db

# Optional: HMAC signing secret. Falls back to APP_PASSWORD if unset.
# Set this independently so rotating APP_PASSWORD does not invalidate tokens.
TOKEN_SECRET=
```

---

### F-04 — `TOKEN_SECRET` fallback behaviour is documented but the security implication is not explained

**Severity**: High
**Location**: `README.md` line 78, `docs/DEPLOYMENT.md` line 31, `docs/ARCHITECTURE.md` §4.1, `src/lib/auth.ts` line 4
**Finding**: All three documents note that `TOKEN_SECRET` falls back to `APP_PASSWORD`. None of them explain the operational consequence: **rotating `APP_PASSWORD` (e.g., after a suspected compromise) will silently invalidate all existing sessions** if `TOKEN_SECRET` is not set separately. This is a security-relevant operational detail that operators need to understand before going to production.
**Recommendation**: Add a callout box in `docs/DEPLOYMENT.md` §2 and `docs/ARCHITECTURE.md` §4.1:

> **Warning**: If `TOKEN_SECRET` is not set, the token signing key is derived from `APP_PASSWORD`. Changing `APP_PASSWORD` will immediately invalidate all active sessions. For production deployments, always set `TOKEN_SECRET` to an independent high-entropy value so that password rotation and token rotation can be managed separately.

---

### F-05 — SVG upload XSS risk is completely undocumented

**Severity**: Critical
**Location**: `src/app/api/upload/logo/route.ts` lines 7–12, `docs/ARCHITECTURE.md` §5.3
**Finding**: The upload endpoint accepts `image/svg+xml` and writes the raw bytes to disk. SVG files can contain embedded `<script>` tags, `<foreignObject>` elements, and `javascript:` URIs. When the file is later served via `/api/logos/{filename}` with `Content-Type: image/svg+xml`, a browser will execute the embedded script in the origin of the application. The architecture doc mentions "MIME 校验、大小限制、防路径穿越" but says nothing about SVG XSS.
**Recommendation**:
1. Add a security warning to `docs/ARCHITECTURE.md` §5.3 and `docs/DEPLOYMENT.md` §7 (known issues):

> **SVG XSS Risk**: SVG files are accepted for brand logos. SVG is an active content format — a malicious SVG can execute JavaScript in the browser when served from the same origin. In the current single-user deployment model this risk is low (only the authenticated owner uploads files), but it should be noted for any future multi-user extension. Mitigation options include: serving logos from a separate cookieless domain, sanitising SVG content server-side before writing to disk, or restricting accepted types to raster formats only.

2. Add an inline comment in `route.ts` above the `ALLOWED_TYPES` map flagging this.

---

### F-06 — No API request/response schemas documented anywhere

**Severity**: High
**Location**: `docs/PRD.md` §8, `docs/ARCHITECTURE.md` §5
**Finding**: The PRD lists all endpoints in a table (method, path, description) but provides zero request body schemas, zero response body schemas, and zero example `curl` calls. The architecture doc repeats the same table. A developer integrating against this API (or writing automated tests) must read the source code to discover:
- What fields `POST /api/catalog` requires vs. accepts optionally
- What the `groupBy` query parameter values are and what shape each returns
- What fields `PATCH /api/spools/{id}` accepts (the whitelist is only in the route handler)
- What `POST /api/auth/login` returns (`{ token, expiresAt }`)

**Recommendation**: Add an `docs/API.md` file (or expand PRD §8) with per-endpoint documentation in the following format:

```
### POST /api/auth/login
Request body:
  { "password": string }
Response 200:
  { "token": string, "expiresAt": number (Unix ms) }
Response 401:
  { "error": "密码错误" }
```

At minimum, document the non-obvious endpoints: `GET /api/catalog` (all `groupBy` modes and their response shapes), `PATCH /api/spools/{id}` (allowed fields), and `POST /api/catalog/brand-rename`.

---

### F-07 — `GET /api/catalog` `groupBy` modes are undocumented in the architecture doc

**Severity**: Medium
**Location**: `docs/ARCHITECTURE.md` §5.1, `src/app/api/catalog/route.ts` lines 17–189
**Finding**: The architecture doc says `GET /api/catalog` supports "列表/搜索/分组（`groupBy`）" but does not list the four valid values (`brandList`, `brand`, `material`, `materialType`) or their distinct response shapes. The `brandList` mode returns `{ brand, logo_url }[]`; the `brand` mode returns `{ brand, logo_url, count, materials[], materialTypes[], spoolCount }`; the `material` mode returns `{ material_type, subMaterialCount, brandCount, count, spoolCount }`; the `materialType` mode requires a `materialType` query param and returns `{ material, brandCount, colorCount, spoolCount }[]`. These are four completely different response contracts.
**Recommendation**: Document each `groupBy` mode with its required parameters and response shape in `docs/PRD.md` §8.2 or a dedicated `docs/API.md`.

---

### F-08 — No pagination documented as a known limitation

**Severity**: Medium
**Location**: `docs/ARCHITECTURE.md` §9, `docs/PRD.md` §11.3, `src/app/api/catalog/route.ts`, `src/app/api/spools/route.ts`
**Finding**: Every `GET` list endpoint (`/api/catalog`, `/api/spools`, `/api/locations`) performs a full-table scan with no `limit`/`offset`/`cursor` parameters. The known-limitations sections in both the architecture doc and PRD mention SQLite concurrency and single-user mode, but neither mentions the absence of pagination. For a personal filament collection this is acceptable, but it should be explicitly documented so a future contributor does not assume pagination exists.
**Recommendation**: Add to `docs/ARCHITECTURE.md` §9 (已知限制):

> 5. 所有列表接口均无分页，全量返回数据库记录。适合个人规模（数百条记录），不适合大规模数据集。

---

### F-09 — Dual authentication channels (Cookie vs. Bearer Token) are documented but the token storage split is not explained clearly

**Severity**: Medium
**Location**: `docs/ARCHITECTURE.md` §4.2–4.3
**Finding**: The architecture doc correctly describes the dual-channel approach (middleware reads Cookie, API routes read Bearer header). However, it does not explain *why* two channels are needed, nor does it document the login flow that writes both: the login page stores the token in `localStorage` AND sets a `spool_tracker_token` cookie. A developer reading only the architecture doc would not understand that the cookie is set client-side by the login page (not by the login API response), which is an unusual pattern.
**Recommendation**: Add a sequence diagram or numbered flow to §4 explaining:
1. `POST /api/auth/login` → returns `{ token, expiresAt }` in JSON body (no Set-Cookie header)
2. Login page JS writes `localStorage.spool_tracker_token = token` and `document.cookie = "spool_tracker_token=..."`
3. Subsequent page navigations: middleware reads the cookie
4. Subsequent API calls: `apiFetch` reads localStorage and injects `Authorization: Bearer`

---

### F-10 — No logout endpoint documented in README; middleware whitelist references `/api/auth/logout` but README env-var table does not mention it

**Severity**: Low
**Location**: `README.md`, `src/middleware.ts` line 4
**Finding**: The README's "常用命令" section and the feature list do not mention logout. The middleware correctly whitelists `/api/auth/logout`. The PRD §8.1 and architecture doc §5.1 do document it. The README is the first document a new user reads and should at minimum reference that a logout endpoint exists.
**Recommendation**: Add a one-line note to the README "注意事项" section: "登出接口：`POST /api/auth/logout`（清空 Cookie，前端同步清理 localStorage）。"

---

### F-11 — `src/lib/auth.ts` dual-runtime HMAC strategy has no inline explanation

**Severity**: Medium
**Location**: `src/lib/auth.ts` lines 50–58
**Finding**: The file implements two HMAC signing paths: an async Web Crypto path (Edge-compatible) for `verifyToken`, and a synchronous Node.js `crypto.createHmac` path for `generateToken`. The comment on line 50 says "Sync helpers for Node.js runtime" and line 53 explains the dynamic `require`. However, there is no comment explaining *why* `generateToken` cannot use Web Crypto (it is called at login time in a Node.js API route, not in Edge middleware, so the sync path is safe and avoids the async overhead). Without this context, a future developer might "fix" the dynamic require by switching to Web Crypto and inadvertently break the Edge middleware path.
**Recommendation**: Add a block comment above `hmacSignSync`:

```ts
/**
 * Synchronous HMAC using Node.js built-in crypto.
 * Used only in generateToken(), which runs exclusively in Node.js API routes.
 * Do NOT use this in middleware.ts — that runs in the Edge Runtime where
 * Node's `crypto` module is unavailable. Use hmacSign() (Web Crypto) there.
 */
```

---

### F-12 — `safeEqual` length-mismatch branch leaks timing information — undocumented

**Severity**: Medium
**Location**: `src/app/api/auth/login/route.ts` lines 27–36
**Finding**: The `safeEqual` function attempts constant-time comparison. When lengths differ, it calls `timingSafeEqual(bufA, bufA)` (comparing `a` against itself) to consume time, then returns `false`. This is a reasonable mitigation but it is not a true constant-time comparison for different-length inputs — the time taken still depends on the length of the *submitted* password (not the expected one), which can leak the length of the expected password via timing side-channel if an attacker submits passwords of varying lengths. This is a known limitation of `timingSafeEqual`-based approaches. It is not documented anywhere.
**Recommendation**: Add an inline comment explaining the limitation and the accepted risk:

```ts
// Note: when lengths differ we still call timingSafeEqual to avoid a trivially
// fast rejection, but the time taken scales with len(a) not len(b), so the
// length of APP_PASSWORD can theoretically be inferred via timing. For a
// single-user self-hosted deployment this risk is accepted.
```

Also note this in `docs/ARCHITECTURE.md` §4 under a "Security Notes" subsection.

---

### F-13 — `docs/PRD.md` §5.1 lists `material` as a required field but the API and schema treat it as optional

**Severity**: High (accuracy)
**Location**: `docs/PRD.md` §5.1 line 108 (`material` listed under "必填字段"), `prisma/schema.prisma` line 12 (`material String` — no `?`), `src/app/api/catalog/route.ts` line 225 (`const material = body.material || ""`)
**Finding**: The PRD lists `material` as a required field of `GlobalFilament`. The Prisma schema defines it as `String` (non-nullable), which is consistent. However, the API route sets `material` to an empty string if not provided (`body.material || ""`), effectively making it optional at the API level while the schema requires a non-null value. The PRD is therefore partially accurate (schema-level required, API-level optional with empty-string default). This inconsistency is not documented.
**Recommendation**: Decide on the intended behaviour and align all three layers. If `material` is truly optional (a sub-type descriptor like "Matte" or "Silk"), make it nullable in the schema. If it is required, add validation in the API route. Update the PRD to reflect the chosen behaviour.

---

### F-14 — `docs/PRD.md` §3.2 item 2 documents a known bug without a resolution path

**Severity**: Low
**Location**: `docs/PRD.md` §3.2 line 67
**Finding**: The PRD notes "品牌重命名后端接口当前导出为 `POST /api/catalog/brand-rename`，品牌页前端调用方法与其不完全一致，属于待修复项。" This is good transparency, but there is no linked issue, no owner, and no target version. The test-case doc (TC2-CAT-022) even tests that `PATCH /api/catalog/brand-rename` returns 405, implying the inconsistency is known and tested but not fixed.
**Recommendation**: Either fix the inconsistency or add a GitHub issue reference and a target milestone to the PRD entry so it does not silently persist across releases.

---

### F-15 — No CHANGELOG or migration guide exists

**Severity**: Medium
**Location**: Project root
**Finding**: There is no `CHANGELOG.md` and no migration guide. The project is at `v0.1.0` (`package.json`) but the docs reference `v1.1`. There is no record of what changed between versions, no breaking-change notices, and no database migration notes beyond "prisma migrate deploy runs automatically." If a user upgrades from an older Docker image, they have no way to know whether the schema changed or whether any manual steps are required.
**Recommendation**: Create a `CHANGELOG.md` at the project root following Keep a Changelog format. At minimum, document the current state as the initial release and note that all Prisma migrations are applied automatically on container start.

---

### F-16 — `next.config.ts` `serverActions.bodySizeLimit: "10mb"` is undocumented

**Severity**: Low
**Location**: `next.config.ts` line 7, `docs/DEPLOYMENT.md` §5 (Nginx `client_max_body_size 10M`)
**Finding**: The Nginx example correctly sets `client_max_body_size 10M` to match the Next.js Server Actions body limit. However, neither the README nor the architecture doc explains *why* this limit exists (it is needed for the logo upload flow which uses a Server Action body, not a standard multipart form). The upload route itself uses `request.formData()` and enforces a 5 MB file limit, but the 10 MB config headroom is not explained.
**Recommendation**: Add a comment to `next.config.ts`:

```ts
serverActions: {
  // Logo upload uses Server Actions; 10 MB headroom covers the 5 MB file
  // limit plus multipart encoding overhead. Nginx client_max_body_size
  // must be set to the same value or higher.
  bodySizeLimit: "10mb",
},
```

---

### F-17 — `QRScanner.tsx` silently swallows camera permission errors

**Severity**: Low
**Location**: `src/components/QRScanner.tsx` lines 35–37
**Finding**: The `catch` block in `startScanner` is empty with only a comment "Camera permission denied or not available." The user sees a black box with no feedback. This is a UX issue, but it is also a documentation gap: the README and deployment guide mention "扫码依赖 HTTPS 或 localhost" but do not document what the user experience is when the camera is unavailable (silent failure vs. error message).
**Recommendation**: Add to `docs/DEPLOYMENT.md` §7 (Q2):

> If the camera permission is denied, the scanner area will appear as a black box with no error message. This is a known limitation — the user must manually grant camera permission in browser settings and reload the page.

---

### F-18 — `GlobalFilament` interface in `src/lib/types.ts` omits `updated_at`

**Severity**: Low (accuracy)
**Location**: `src/lib/types.ts` line 64, `prisma/schema.prisma` line 68
**Finding**: The Prisma schema defines `updated_at DateTime @updatedAt` on `GlobalFilament`. The shared `GlobalFilament` TypeScript interface in `src/lib/types.ts` includes `created_at?: string` but omits `updated_at`. This means any component using the shared type cannot access `updated_at` without a type assertion.
**Recommendation**: Add `updated_at?: string` to the `GlobalFilament` interface in `src/lib/types.ts` and add a comment noting that both fields are ISO 8601 strings when returned from the API (Prisma serialises `DateTime` as ISO strings in JSON responses).

---

## Summary Table

| ID | Severity | Category | Finding |
|---|---|---|---|
| F-01 | Low | README accuracy | Version table internally consistent; add version badges |
| F-02 | Low | README completeness | shadcn version not pinned in tech-stack table |
| F-03 | **High** | README accuracy | `.env.example` referenced but does not exist |
| F-04 | **High** | Security documentation | `TOKEN_SECRET` fallback operational consequence undocumented |
| F-05 | **Critical** | Security documentation | SVG upload XSS risk not documented anywhere |
| F-06 | **High** | API documentation | No request/response schemas for any endpoint |
| F-07 | Medium | API documentation | `groupBy` modes and response shapes undocumented |
| F-08 | Medium | Architecture documentation | No-pagination limitation not documented |
| F-09 | Medium | Architecture documentation | Dual-channel auth flow not explained as a sequence |
| F-10 | Low | README completeness | Logout endpoint not mentioned in README |
| F-11 | Medium | Inline documentation | Dual-runtime HMAC strategy not explained in code |
| F-12 | Medium | Inline documentation | `safeEqual` timing limitation not documented |
| F-13 | **High** | Accuracy | PRD lists `material` as required; API treats it as optional |
| F-14 | Low | Changelog | Known bug documented without issue reference or target |
| F-15 | Medium | Changelog | No CHANGELOG or migration guide exists |
| F-16 | Low | Inline documentation | `bodySizeLimit` rationale not explained |
| F-17 | Low | Inline documentation | Silent camera failure not documented in deployment guide |
| F-18 | Low | Accuracy | `GlobalFilament` TS interface missing `updated_at` field |

---

## Priority Recommendations

1. **Immediate** (before any public/team deployment): Create `.env.example` (F-03), document the SVG XSS risk (F-05), and add the `TOKEN_SECRET` operational warning (F-04).
2. **Short-term**: Add API request/response schemas (F-06, F-07) and resolve the `material` field inconsistency (F-13).
3. **Medium-term**: Add inline comments to `auth.ts` and `login/route.ts` (F-11, F-12), create a `CHANGELOG.md` (F-15), and document the no-pagination limitation (F-08).
4. **Housekeeping**: Fix the `GlobalFilament` interface (F-18), add version badges to README (F-01, F-02), and document the logout endpoint in README (F-10).
