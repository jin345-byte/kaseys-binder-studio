# Deployment

## Cloudflare Pages

Connect this repository to Cloudflare Pages with these settings:

- Repository: `jin345-byte/kaseys-binder-studio`
- Production branch: `main`
- Framework preset: None
- Build command: leave blank
- Build output directory: `public`

After the initial connection, every push to `main` will automatically publish the latest PWA build.

## Release workflow

1. Develop and validate the Chrome extension build.
2. Synchronize browser-compatible changes into `public/`.
3. Run JavaScript syntax checks, duplicate-ID checks, manifest validation, and ZIP integrity checks.
4. Commit the synchronized PWA to `main`.
5. Cloudflare Pages deploys automatically.

The Chrome extension remains the development baseline; the hosted PWA is generated from the validated extension release.
