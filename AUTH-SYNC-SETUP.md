# Google login + D1 sync

The repo now includes guest mode, Continue with Google, secure Worker sessions, and automatic binder snapshot sync. The UI stays in guest-only mode until D1 and Google are connected.

## D1
Create a D1 database named `kaseys-binder-studio-db`, copy its Database ID, and add a `DB` binding in `wrangler.jsonc`. Apply `migrations/0001_auth_sync.sql` to the remote database.

## Google
Create a Google OAuth Client ID of type **Web application**. Add the production domain under Authorized JavaScript origins. Add the workers.dev origin too while testing if desired. Put the public Client ID in `wrangler.jsonc` under `vars.GOOGLE_CLIENT_ID`.

No Google client secret is used. The Worker verifies the Google ID token signature, issuer, audience, and expiry before issuing its own HttpOnly session cookie.

## Deploy
Once the `assets` block is in `wrangler.jsonc`, preferred deploy command: `npx wrangler deploy`.

## Sync behavior
- Guest mode: local IndexedDB/localStorage only.
- First Google login with no cloud snapshot: current guest binder is copied to the account.
- Existing account: cloud binder is loaded automatically.
- Signed in: sync checks run about every 15 seconds, on manual Sync now, when connectivity returns, and when the app is backgrounded.
- Sign out: cloud data remains in D1 and the device returns to a fresh guest binder.

D1 has a 2 MB maximum row size. Binder snapshots are gzip-compressed where supported. Very large locally uploaded images may still exceed that limit; URL artwork and normal binder/card data are the intended sync path. R2 is the natural later upgrade for unrestricted uploaded-image sync.
