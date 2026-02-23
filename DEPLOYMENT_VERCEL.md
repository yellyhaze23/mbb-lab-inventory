# Vercel Deployment Guide (Single App, Two Portals)

This project is a **single Vite React app** that serves:

- **Admin Portal** (login + admin pages)
- **Student Portal** (`/StudentUse`)

Both portals run under one Vercel deployment/domain.

---

## 1. Prerequisites

- Vercel account
- Supabase project (DB + Auth + Edge Functions)
- Repository connected to Vercel

---

## 2. Confirm Routes (already in app)

From `src/pages.config.js`:

- Main page: `Login`
- Student page: `StudentUse`

Expected URLs after deploy:

- `https://your-domain/Login` (Admin login)
- `https://your-domain/StudentUse` (Student portal)

Optional: if you want `/` to open student portal instead, change:

```js
mainPage: "Login"
```

to:

```js
mainPage: "StudentUse"
```

---

## 3. Vercel Project Settings

When importing project in Vercel:

- **Framework Preset**: `Vite`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

---

## 4. Environment Variables (Vercel)

Add these in **Vercel → Project Settings → Environment Variables**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use the same values as your local `.env`.

---

## 5. SPA Fallback (important)

Because this is React Router SPA, direct visits to `/Login` or `/StudentUse` must fallback to `index.html`.

Create `vercel.json` in project root (if not existing):

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

This prevents 404 on refresh/deep links.

---

## 6. Supabase Edge Functions (separate deploy)

Frontend on Vercel calls Supabase Edge Functions directly (via `VITE_SUPABASE_URL/functions/v1/...`).

Deploy/update functions from your project:

```bash
supabase functions deploy verify-pin
supabase functions deploy student-use-item
supabase functions deploy student-items
supabase functions deploy get-lab-settings
supabase functions deploy set-lab-pin
supabase functions deploy invite-admin
```

Make sure Supabase function secrets are set in Supabase (not Vercel) when needed.

---

## 7. Production Verification Checklist

After deploy, verify:

1. `/Login` loads and admin can sign in
2. `/StudentUse` loads and PIN verification works
3. Student item search and usage submission works
4. Admin can update PIN in Settings
5. Browser refresh on `/Login` and `/StudentUse` does not 404

---

## 8. Notes for One-App Two-Portal Setup

- Keep one domain, different routes:
  - Admin: `/Login`, `/Dashboard`, `/Chemicals`, etc.
  - Student: `/StudentUse`
- Access control stays in app/auth logic and Supabase RLS + Edge Function checks.
- No need to create a separate Vercel project for student portal.

