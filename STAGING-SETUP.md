# Binder Studio staging

This branch is reserved for staging/testing before production changes reach `main`.

## Safety rules
- Do not point `binderstudio.cc` at this branch/worker.
- Use a separate Cloudflare Worker name for staging.
- Use a separate D1 database for staging.
- Keep `src/worker.js` API behavior aligned with production unless intentionally testing backend changes.

## Recommended staging Worker
`kaseys-binder-studio-staging`

## Recommended staging D1 database
`kaseys-binder-studio-staging-db`

Apply `migrations/0001_auth_sync.sql` to the staging D1 database.

## Google OAuth
Add the staging workers.dev origin to the existing Google Web Client ID's Authorized JavaScript origins. Production `https://binderstudio.cc` remains unchanged.

## Deployment
Use a staging-specific Wrangler config or temporarily override only the Worker name and D1 database binding. Do not reuse the production D1 database for staging tests.

## Baseline auth test
Before merging new UI work, confirm on the staging URL:
1. Guest mode loads.
2. Continue with Google appears.
3. Google sign-in succeeds.
4. Create/edit a binder.
5. Sync now succeeds.
6. Reload and verify the binder remains.
7. Sign out.
8. Sign back in and verify the cloud binder restores.
