# Kasey's Binder Studio

Source repository for Kasey's Binder Studio.

## Deployment layout

- `public/` — hosted PWA / Cloudflare Pages production build
- Chrome extension remains the development source; stable extension releases are synchronized into `public/` for deployment.

## Cloudflare Pages settings

- Production branch: `main`
- Build command: leave blank
- Build output directory: `public`

Once Cloudflare Pages is connected to this repository, a push to `main` will automatically publish the current PWA.

## Current baseline

PWA baseline: Binder Studio v2.6.0 — Guided Tour Cleanup.
