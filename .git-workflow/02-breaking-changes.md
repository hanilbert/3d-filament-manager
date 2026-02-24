# Breaking Change & Dependency Analysis

## 1. Breaking Change Assessment

### 1.1 API Breaking Changes

| Change | Severity | Impact |
|--------|----------|--------|
| SVG upload rejected | **Breaking** | Clients uploading SVG logos will get 400 error. Existing SVG logos still served (as download). |
| Login returns 429 on rate limit | **Additive** | New response code; existing clients may not handle 429. |
| Spool PATCH metadata 10KB limit | **Restrictive** | Clients sending >10KB metadata will get 400. Unlikely in practice. |
| Catalog DELETE error message changed | **Non-breaking** | Error message text changed but status codes unchanged. |
| Catalog/Spools GET new sort params | **Additive** | New optional query params; existing calls unaffected. |

### 1.2 Authentication Breaking Changes

| Change | Severity | Impact |
|--------|----------|--------|
| HttpOnly cookie for token | **Additive** | Server now sets HttpOnly cookie. Client-side cookie setting removed. Old tokens in localStorage still work via Bearer header. |
| TOKEN_SECRET env var | **Non-breaking** | Optional; falls back to APP_PASSWORD if not set. |
| Constant-time HMAC verify | **Non-breaking** | Internal implementation change; token format unchanged. |

### 1.3 UI Breaking Changes

| Change | Severity | Impact |
|--------|----------|--------|
| Spools page complete refactor | **Visual** | Desktop shows table instead of cards. Mobile shows new card layout. |
| Brand detail page refactor | **Visual** | Desktop shows table; mobile shows grouped cards. Brand rename removed. |
| Location type label "AMS 插槽" → "AMS" | **Visual** | Display label change only. |

**Verdict:** The only truly breaking change is **SVG upload rejection**. All other changes are additive or visual.

---

## 2. Dependency Change Analysis

### 2.1 New Dependencies
**None.** No new packages added. All changes use existing dependencies:
- `crypto` (Node.js built-in) — already used
- `@prisma/client` — already used
- `lucide-react` — already used (ArrowUp, ArrowDown, ArrowUpDown icons)

### 2.2 Removed Dependencies
**None.** No packages removed.

### 2.3 Version Changes
**None.** No version bumps in package.json.

---

## 3. Database Schema Modifications

**None.** No changes to `prisma/schema.prisma`. No new migrations required.

---

## 4. Configuration Changes

| Config | Change | Action Required |
|--------|--------|-----------------|
| `.env.example` | Added `TOKEN_SECRET=` | Optional. Document in deployment guide. |
| `next.config.ts` | Added security headers + `headers()` function | No action needed; auto-applied. |
| `Dockerfile` | Prisma CLI copied directly; CMD uses `node node_modules/prisma/build/index.js` | Rebuild Docker image required. |

---

## 5. Migration Requirements

### 5.1 Required Actions for Deployment
1. **Rebuild Docker image** — Dockerfile changed (prisma CLI path).
2. **No database migration** — No schema changes.
3. **Optional: Set TOKEN_SECRET** — For separate signing key. Not required.

### 5.2 Rollback Considerations
- If rolling back, clients with HttpOnly cookies will still have valid tokens (format unchanged).
- SVG logos already uploaded remain accessible (served as attachment download).
- No database changes to roll back.

---

## 6. Documentation Update Needs

| Document | Status | Notes |
|----------|--------|-------|
| README.md | **Updated in this changeset** | Reflects current features and tech stack. |
| DEPLOYMENT.md | **Updated in this changeset** | Simplified; includes TOKEN_SECRET. |
| .env.example | **Updated in this changeset** | TOKEN_SECRET added with comment. |

---

## 7. Backward Compatibility Summary

**Overall Risk: LOW**

- No database schema changes
- No new dependencies
- API changes are additive (new sort params) or restrictive (SVG block, metadata limit)
- Auth changes are backward-compatible (localStorage fallback preserved)
- The only user-visible breaking change is SVG upload rejection, which is intentional for security
