# SOP Hub (full build)

The real SOP website: Next.js, hosted on Vercel, with Supabase for the database, logins and permissions.
The test site at the repo root keeps running on GitHub Pages until the pilot.

## Run it locally

```
npm install
npm run dev
```

Then open http://localhost:3000.

## Deploying

Vercel builds this folder on every push. In the Vercel project settings, **Root Directory** must be `web`.
