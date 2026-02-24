# Deployment Guide
[Back: Inventory Logic](./08-Inventory-Logic.md) | [Next: Troubleshooting](./10-Troubleshooting.md)

## Environment Variables
## Frontend (`.env`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_USE_SUPABASE_MUTATIONS` (feature flag)
- `VITE_BYPASS_AUTH` (dev bypass switch)
- `VITE_USE_SUPABASE_ITEMS`
- `VITE_USE_SUPABASE_LOGS`
- `VITE_USE_SUPABASE_PROFILES`

## Edge Functions (Supabase secrets)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BASE_URL` / `VITE_BASE_URL` (required by invite-admin redirect flow)

## Local Build Commands
```bash
npm install
npm run build
npm run preview
```

## Supabase Setup
1. Create/open Supabase project.
2. Configure secrets for edge functions.
3. Apply DB migrations:
```bash
supabase db push
```
4. Deploy edge functions:
```bash
supabase functions deploy verify-pin
supabase functions deploy student-items
supabase functions deploy student-use-item
supabase functions deploy get-lab-settings
supabase functions deploy set-lab-pin
supabase functions deploy invite-admin
supabase functions deploy invite-user
supabase functions deploy msds-signed-url
```

## RLS Enablement
RLS and policies are migration-driven. After migration:
- verify tables have RLS enabled in Supabase dashboard.
- verify policies exist for app-critical tables and storage objects.

## Hosting Notes
Current repo includes `vercel.json` with SPA rewrite:
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/" }] }
```
This supports direct URL reloads for React Router routes.

## Suggested Production Flow
1. Push code to main branch.
2. Build validation (`npm run build`, `npm run lint`).
3. Deploy frontend (Vercel/other static host).
4. Apply migrations to production Supabase.
5. Deploy/update edge functions.
6. Run smoke tests: login, dashboard load, stock operations, student PIN, MSDS view/download.

## Post-Deploy Checklist
- [ ] Frontend env vars correct.
- [ ] Supabase URL and anon key correct.
- [ ] Service role secret set in edge functions.
- [ ] All edge functions deployed and reachable.
- [ ] RLS policies active.
- [ ] Student PIN can be validated.
- [ ] Admin invite flow works.
- [ ] MSDS signed URL flow works.

