# Git Context

## Current Branch
main

## Recent Commits
```
4057ff2 feat(ui): AMS 位置表单字段扁平化
7439999 feat: 全局移除 short_code 字段
3c9a314 fix: address code quality and architecture review findings
5464976 feat(ui): 品牌表格固定列 + 品牌下拉选择 + 表单参数重组
202c3da feat: 位置标签改为页内渲染并支持下载图片
d2caaa9 feat(ui): update catalog displays to show material types
d8977f0 feat(ui): add material type selection and navigation
eb49dd8 feat(api)!: support material type filtering and grouping
29a3cf8 feat(schema): add material_type field to catalog model
7fadf5a fix(config): add database files to .gitignore
```

## Working Tree Status
On branch main (up to date with origin/main).

### Modified Files (23 files, unstaged)
- `.env.example` — Added TOKEN_SECRET env var
- `Dockerfile` — Copy prisma CLI directly, avoid npx network fetch
- `README.md` — Complete rewrite with updated features, tech stack, structure
- `docs/DEPLOYMENT.md` — Simplified and updated deployment guide
- `next.config.ts` — Added security headers (CSP, X-Frame-Options, etc.)
- `src/app/(auth)/login/page.tsx` — Open redirect prevention, rate limit UI, HttpOnly cookie
- `src/app/api/auth/login/route.ts` — Rate limiting, HttpOnly cookie server-side
- `src/app/api/catalog/[id]/route.ts` — DELETE uses Prisma error codes instead of pre-count
- `src/app/api/catalog/route.ts` — Server-side sorting with whitelist validation
- `src/app/api/locations/route.ts` — Added try-catch error handling
- `src/app/api/logos/[filename]/route.ts` — SVG download enforcement for XSS prevention
- `src/app/api/spools/[id]/route.ts` — Metadata size validation (10KB limit)
- `src/app/api/spools/route.ts` — Server-side sorting with whitelist validation
- `src/app/api/upload/logo/route.ts` — SVG upload removed, mkdir optimization
- `src/app/catalog/brand/[brand]/page.tsx` — Desktop table view, sort headers, grouped mobile view
- `src/app/locations/page.tsx` — Error state handling
- `src/app/spools/page.tsx` — Major refactor: desktop table, mobile card, sort, restock/delete
- `src/components/LocationForm.tsx` — Bulk AMS creation link
- `src/lib/auth.ts` — Constant-time HMAC verification via Web Crypto
- `src/lib/db.ts` — Cache Prisma client in all environments
- `src/lib/fetch.ts` — HttpOnly cookie support, credentials same-origin
- `src/lib/location-types.ts` — Label change "AMS 插槽" → "AMS"
- `src/middleware.ts` — Open redirect prevention

### Untracked Files
- `.full-review/` — Review output files
- `.git-workflow/` — Workflow state files
- `AGENTS.md` — Agent instructions
- `ARCHITECTURE_REVIEW.md` — Architecture review document
- `DOCUMENTATION_REVIEW.md` — Documentation review
- `PERFORMANCE_ANALYSIS.md` — Performance analysis
- `SECURITY_AUDIT.md` — Security audit
- `src/app/locations/bulk-ams/` — Bulk AMS creation page (new feature)
- `src/app/spool/[id]/print/bak` — Backup file

## Diff Statistics
```
 .env.example                           |   3 +
 Dockerfile                             |   6 +-
 README.md                              | 133 ++++-----
 docs/DEPLOYMENT.md                     | 208 ++++----------
 next.config.ts                         |  31 +++
 src/app/(auth)/login/page.tsx          |  21 +-
 src/app/api/auth/login/route.ts        |  53 +++-
 src/app/api/catalog/[id]/route.ts      |  28 +-
 src/app/api/catalog/route.ts           |  48 +++-
 src/app/api/locations/route.ts         |  20 +-
 src/app/api/logos/[filename]/route.ts  |  19 +-
 src/app/api/spools/[id]/route.ts       |  10 +-
 src/app/api/spools/route.ts            |  53 +++-
 src/app/api/upload/logo/route.ts       |  11 +-
 src/app/catalog/brand/[brand]/page.tsx | 240 +++++++++++-----
 src/app/locations/page.tsx             |   5 +
 src/app/spools/page.tsx                | 493 ++++++++++++++++++++++++++++-----
 src/components/LocationForm.tsx        |  12 +
 src/lib/auth.ts                        |  27 +-
 src/lib/db.ts                          |   3 +-
 src/lib/fetch.ts                       |  13 +-
 src/lib/location-types.ts              |   2 +-
 src/middleware.ts                      |   5 +-
 23 files changed, 1015 insertions(+), 429 deletions(-)
```

## Change Categories

### Security Improvements
- **Rate limiting** on login endpoint (15min window, 10 attempts max per IP)
- **HttpOnly cookies** for token storage (server-side Set-Cookie)
- **Open redirect prevention** in login flow and middleware
- **Security headers** (CSP, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy)
- **SVG upload blocked** to prevent stored XSS
- **SVG download enforcement** for legacy uploads
- **Constant-time HMAC verification** using Web Crypto verify
- **Metadata size validation** (10KB limit on spool metadata)
- **TOKEN_SECRET** environment variable for separate signing key

### UI/UX Improvements
- **Desktop table views** for spools and catalog brand pages with sortable columns
- **Mobile card views** with grouped items for brand page
- **Server-side sorting** with whitelist-validated sort fields
- **Restock and delete** actions on empty spools list
- **Bulk AMS creation** link in location form
- **Error state handling** on locations page

### Infrastructure
- **Dockerfile**: Copy prisma CLI directly, avoid npx network fetch
- **Prisma client**: Cache in all environments to prevent connection exhaustion
- **API error handling**: Use Prisma error codes for catalog DELETE, try-catch on locations GET

### Documentation
- **README.md**: Complete rewrite with current features
- **DEPLOYMENT.md**: Simplified deployment guide with updated instructions
