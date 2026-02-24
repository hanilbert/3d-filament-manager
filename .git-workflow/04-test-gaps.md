# Test Gap Analysis

## Current State

The project has **zero test coverage** — no test framework, no test files, no CI pipeline.

## Critical Test Gaps (from this changeset)

### Priority 1: Security-Critical

1. **Rate limiter logic** (`src/app/api/auth/login/route.ts`)
   - Verify 429 returned after MAX_ATTEMPTS
   - Verify window reset after LOGIN_WINDOW_MS
   - Verify cleanup interval removes stale entries
   - Verify different IPs are tracked independently

2. **HMAC verification** (`src/lib/auth.ts`)
   - Verify valid tokens pass verification
   - Verify tampered tokens fail
   - Verify expired tokens fail
   - Verify constant-time behavior (no timing side-channel)

3. **Open redirect prevention** (`src/app/(auth)/login/page.tsx`, `src/middleware.ts`)
   - Verify `//evil.com` is rejected
   - Verify absolute URLs are rejected
   - Verify valid relative paths work

### Priority 2: API Behavior

4. **Sort parameter validation** (`src/app/api/catalog/route.ts`, `src/app/api/spools/route.ts`)
   - Verify invalid sort fields fall back to default
   - Verify SQL injection via sort params is blocked
   - Verify asc/desc ordering works correctly

5. **Metadata size validation** (`src/app/api/spools/[id]/route.ts`)
   - Verify >10KB metadata is rejected
   - Verify valid metadata passes
   - Verify null/undefined metadata handling

6. **Catalog DELETE error handling** (`src/app/api/catalog/[id]/route.ts`)
   - Verify P2003 (FK constraint) returns 400
   - Verify P2025 (not found) returns 404
   - Verify successful delete returns 200

### Priority 3: UI Behavior

7. **Spools page sorting** (`src/app/spools/page.tsx`)
   - Verify sort toggle changes order
   - Verify active/empty tabs maintain independent sort state
   - Verify restock creates new spool and navigates
   - Verify delete shows confirmation and removes spool

8. **Brand detail page** (`src/app/catalog/brand/[brand]/page.tsx`)
   - Verify grouping logic for mobile view
   - Verify sort headers work
   - Verify desktop table renders correctly

## Recommendations

1. **Immediate:** Fix the unused `hmacSign` function warning (remove it or mark as used)
2. **Short-term:** Add vitest + testing-library for critical security paths
3. **Medium-term:** Add API route integration tests with MSW or supertest
4. **Long-term:** Add E2E tests with Playwright for critical user flows
