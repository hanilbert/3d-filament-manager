# Branch Validation

## Current State
- Branch: `main`
- Tracking: `origin/main` (up to date)
- Workflow: trunk-based (direct push to main)

## Pre-Push Checklist

| Check | Status | Notes |
|-------|--------|-------|
| Branch up to date | PASS | Up to date with origin/main |
| No merge conflicts | PASS | No upstream changes to conflict with |
| No sensitive data | PASS | .env not in changes; TOKEN_SECRET in .env.example is empty |
| Lint clean (new issues) | WARN | 1 new warning: unused `hmacSign` in auth.ts |
| Build passes | FAIL | Pre-existing type error in catalog/route.ts:288 |

## Files to Stage (23 modified + 1 new directory)

### Modified files (stage all):
All 23 modified files listed in git status.

### Untracked files to stage:
- `src/app/locations/bulk-ams/` — New feature (bulk AMS creation page)

### Untracked files to EXCLUDE:
- `.full-review/` — Review artifacts
- `.git-workflow/` — Workflow state files
- `AGENTS.md` — Agent instructions (not project code)
- `ARCHITECTURE_REVIEW.md` — Review document
- `DOCUMENTATION_REVIEW.md` — Review document
- `PERFORMANCE_ANALYSIS.md` — Review document
- `SECURITY_AUDIT.md` — Review document
- `src/app/spool/[id]/print/bak` — Backup file

## Push Strategy
Direct push to `origin/main`. No PR required for trunk-based workflow, but user may opt to create one.
