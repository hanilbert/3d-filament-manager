# Change Categorization

## Analysis

This changeset contains 23 modified files spanning 4 distinct categories:
1. Security hardening (auth, headers, input validation)
2. UI/UX improvements (desktop tables, sorting, mobile cards)
3. Infrastructure (Dockerfile, Prisma caching)
4. Documentation (README, DEPLOYMENT)

## Recommendation: Single Commit

**Rationale:** While the changes span multiple categories, they were developed as a cohesive improvement batch following a security audit and architecture review (referenced in commit `3c9a314`). The security changes and UI changes are interrelated (e.g., HttpOnly cookies affect both the login API and the client-side fetch utility). Splitting into multiple commits would create intermediate states where security features are partially applied.

## Primary Classification

- **Type:** `feat` (the dominant changes are new features: desktop tables, sorting, rate limiting, HttpOnly cookies)
- **Scope:** `security,ui` (dual scope — security hardening + UI improvements)
- **Breaking:** No (SVG upload removal is intentional, all other changes are additive/backward-compatible)

## Change Groupings

### Security (feat)
- Rate limiting on login
- HttpOnly cookie auth
- Open redirect prevention
- Security headers (CSP, etc.)
- SVG upload blocked
- Constant-time HMAC verification
- Metadata size validation
- TOKEN_SECRET env var

### UI/UX (feat)
- Desktop table views with sortable columns
- Mobile card views with grouping
- Server-side sorting API
- Restock/delete actions on empty spools
- Bulk AMS creation link
- Error state handling

### Infrastructure (chore)
- Dockerfile prisma CLI optimization
- Prisma client caching in all environments
- API error handling improvements

### Documentation (docs)
- README.md rewrite
- DEPLOYMENT.md simplification
