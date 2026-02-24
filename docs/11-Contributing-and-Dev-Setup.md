# Contributing and Dev Setup
[Back: Troubleshooting](./10-Troubleshooting.md) | [Back to README](../README.md)

## Prerequisites
- Node.js (recommended: 18+)
- npm
- Supabase project access (for database and edge function work)

## Local Setup
```bash
npm install
npm run dev
```

## Useful Scripts
```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:fix
npm run typecheck
```

## Suggested Branching Strategy
- `main`: deployable branch
- `feature/<short-name>`: feature work
- `fix/<short-name>`: bug fixes
- `docs/<short-name>`: documentation updates

## Commit Convention (Recommended)
- `feat: ...`
- `fix: ...`
- `docs: ...`
- `refactor: ...`
- `chore: ...`

Example:
```text
feat: add msds history modal actions
```

## Development Patterns in This Repo
- Add route pages in `src/pages/` (auto-registered in `pages.config.js` generation flow).
- Keep business/data access inside `src/api/*`.
- Reuse shared UI primitives in `src/components/ui`.
- Keep feature-specific UI under `src/components/<feature>`.
- Prefer backend-enforced permissions (RLS + edge checks), then reflect in UI.

## How to Add a New Module/Page
1. Create page under `src/pages`.
2. Ensure route is available via `pages.config.js` process.
3. Add menu entry in `Layout.jsx` if needed.
4. Create service module under `src/api` for data access.
5. Add/adjust migration if schema changes are needed.
6. Add edge function if server-side privileged access is required.
7. Validate with `lint` + `build`.

## Testing Status
- Automated test suite: **Not found in codebase; may be planned.**
- Current validation style is build/lint + manual functional checks.

## Code Review Checklist (Practical)
- [ ] No direct role trust in frontend-only checks for critical actions.
- [ ] RLS and policy impact reviewed for schema changes.
- [ ] Edge functions validate auth and inputs.
- [ ] Inventory calculations do not allow negative stock.
- [ ] UI loading/error states are covered.
- [ ] Build and lint pass locally.

