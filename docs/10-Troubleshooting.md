# Troubleshooting
[Back: Deployment](./09-Deployment.md) | [Next: Contributing and Dev Setup](./11-Contributing-and-Dev-Setup.md)

## Common Errors

## 401 Unauthorized (Edge Functions)
Possible causes:
- Missing `Authorization: Bearer <access_token>` for protected functions.
- Expired/invalid token.
- Missing `apikey` header in edge calls.

Checks:
- Inspect `src/lib/edgeClient.js` request headers.
- Verify user session in browser devtools and Supabase Auth state.
- Review edge function logs in Supabase dashboard.

## 403 Forbidden
Possible causes:
- User role is not allowed (`admin/super_admin` checks fail).
- `profiles.is_active` is false.
- RLS policy denies operation.

Checks:
- Confirm `profiles` record role and active status.
- Re-check table policies in SQL editor / dashboard.

## 406 / Query Response Errors
Possible causes:
- `.single()` used where row not found.
- select shape mismatch after schema changes.

Checks:
- Validate selected columns in `src/api/*.js`.
- Use `.maybeSingle()` where optional row is expected.

## CORS Errors
Possible causes:
- Function CORS headers mismatch with request method/headers.
- Browser preflight blocked.

Checks:
- Confirm function returns `OPTIONS` with CORS headers.
- Verify request includes allowed headers only.

## Missing Environment Variables
Symptoms:
- App fails on startup (`Missing VITE_SUPABASE_URL...`).
- Edge functions throw missing secret errors.

Checks:
- Verify `.env` keys for frontend.
- Verify Supabase edge function secrets are set.

## Dashboard/Data Fetch Fails
Checklist:
1. Confirm login/session is valid.
2. Confirm `profiles` row exists for logged-in user.
3. Confirm RLS select policies permit current role.
4. Check network tab for failed endpoint/query.
5. Check Supabase logs (database and edge functions).

## Student Mode Issues
Symptoms:
- PIN rejected repeatedly.
- `Too many failed PIN attempts`.

Checks:
- Confirm PIN is set in settings.
- Validate pin expiry (`pin_expires_at`).
- Wait for brute-force lock window to expire (edge function rate control).

## MSDS Issues
Symptoms:
- Cannot upload MSDS.
- View/Download fails.

Checks:
- Ensure file is PDF and <=15MB.
- Verify `msds` bucket exists and is private.
- Verify storage policies for read/write.
- Verify `msds-signed-url` function is deployed and logs no errors.

## Where to Look in Code
- Auth/session handling: `src/lib/AuthContext.jsx`, `src/Layout.jsx`
- Inventory data access: `src/api/itemsDataClient.js`
- Stock RPC orchestration: `src/components/inventory/inventoryHelpers.jsx`
- Student flows: `src/pages/StudentUse.jsx`
- Edge invoker: `src/lib/edgeClient.js`
- Edge functions: `supabase/functions/*`
- RLS + schema: `supabase/migrations/*`

