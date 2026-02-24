# Review Scope

## Target

Full codebase review of the `3d-filament-manager` project — a Next.js 15 App Router application for managing 3D printing filament spools, catalog entries, and storage locations. Uses Prisma ORM with SQLite, Tailwind CSS, shadcn/ui components, and JWT-based authentication.

## Files

### Application Routes (src/app)
- src/app/layout.tsx
- src/app/page.tsx
- src/app/globals.css
- src/app/(auth)/layout.tsx
- src/app/(auth)/login/page.tsx
- src/app/api/auth/login/route.ts
- src/app/api/catalog/route.ts
- src/app/api/catalog/[id]/route.ts
- src/app/api/catalog/brand-rename/route.ts
- src/app/api/locations/route.ts
- src/app/api/locations/[id]/route.ts
- src/app/api/logos/[filename]/route.ts
- src/app/api/spools/route.ts
- src/app/api/spools/[id]/route.ts
- src/app/api/upload/logo/route.ts
- src/app/catalog/page.tsx
- src/app/catalog/[id]/page.tsx
- src/app/catalog/[id]/edit/page.tsx
- src/app/catalog/new/page.tsx
- src/app/catalog/brand/[brand]/page.tsx
- src/app/catalog/material/[material]/page.tsx
- src/app/catalog/material-type/[type]/page.tsx
- src/app/catalog/materials/page.tsx
- src/app/location/[id]/page.tsx
- src/app/location/[id]/edit/page.tsx
- src/app/location/[id]/print/page.tsx
- src/app/location/[id]/print/location-label-printer.tsx
- src/app/locations/page.tsx
- src/app/locations/new/page.tsx
- src/app/spool/[id]/page.tsx
- src/app/spool/[id]/print/page.tsx
- src/app/spool/[id]/print/spool-label-printer.tsx
- src/app/spools/page.tsx

### Components (src/components)
- src/components/BottomNav.tsx
- src/components/CatalogForm.tsx
- src/components/ColorSwatch.tsx
- src/components/ConditionalNav.tsx
- src/components/ConfirmDialog.tsx
- src/components/DetailRow.tsx
- src/components/LocationForm.tsx
- src/components/QRCodeDisplay.tsx
- src/components/QRScanner.tsx
- src/components/SideNav.tsx
- src/components/StatusBadge.tsx
- src/components/ui/ (shadcn/ui components)

### Library (src/lib)
- src/lib/api-auth.ts
- src/lib/auth.ts
- src/lib/db.ts
- src/lib/fetch.ts
- src/lib/location-types.ts
- src/lib/utils.ts
- src/proxy.ts

### Database & Config
- prisma/schema.prisma
- prisma/migrations/
- prisma/backfill-material-type.ts
- next.config.ts
- package.json
- tsconfig.json
- docker-compose.yml
- Dockerfile
- eslint.config.mjs

## Flags

- Security Focus: no
- Performance Critical: no
- Strict Mode: no
- Framework: Next.js (App Router, v15)

## Review Phases

1. Code Quality & Architecture
2. Security & Performance
3. Testing & Documentation
4. Best Practices & Standards
5. Consolidated Report
