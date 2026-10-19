# Kasey's Binder Studio — handoff to Muse (Hibana)
**Prepared:** 2026-10-19 (America/New_York)  
**Snapshot assessed:** main at 8cbb63acb2416d22af8eb85c937c0661e11eb5d7  
**Repository:** https://github.com/jin345-byte/kaseys-binder-studio  
**Recipient:** Muse (Hibana)  
**Source labels:** VERIFIED REPO = inspected GitHub source/metadata; VERIFIED CI = actual Actions logs; HISTORICAL = previous September project handoff/decisions, not retested; UNKNOWN = not substantiated. No production data was changed to prepare this handoff.

## 1. Executive summary (one-page orientation)

Kasey's Binder Studio is a browser-based trading-card binder planning, presentation, artwork-composition, saving, and physical printing application. Users search Pokémon TCG, Pokémon TCG Pocket, and Union Arena card catalogs, fill 4-, 9-, or 12-pocket pages, layer individually sized or multi-pocket artwork, preview and manage multiple binders, and print artwork/card inserts at controlled real-world dimensions. It supports offline/local guest state and an optional Google sign-in plus Cloudflare D1 binder snapshot synchronization.

- **Production:** https://binderstudio.cc. Current UI identifies itself as **v4.0.5**, build marker **4.0.5-production-preview-ui** (VERIFIED REPO and VERIFIED CI published-site log). The October 19 published-site Chromium guest smoke found card search and page navigation working, not authenticated sync.
- **Production-compatible preview:** https://kaseys-binder-studio-prod-preview.jin345.workers.dev; source branch **prod-db-compat-preview**, Worker **kaseys-binder-studio-prod-preview**, configuration **wrangler.prod-preview.jsonc** on that branch. It is designed to use the production D1 binding **read-only**, with mutations blocked (VERIFIED REPO; current deployment SHA and actual availability UNKNOWN).
- **Current main commit:** **8cbb63acb2416d22af8eb85c937c0661e11eb5d7**, 2026-10-19 14:38:02 UTC, merge of PR #7, "Show all binder page numbers in a full-width wrapping grid." Source: https://github.com/jin345-byte/kaseys-binder-studio/commit/8cbb63acb2416d22af8eb85c937c0661e11eb5d7
- **PR #7:** MERGED on 2026-10-19 at 14:38:02 UTC. No open pull requests at review time. It is NOT an open/unsafe-to-merge PR. However its branch Chromium workflow FAILS the fresh-install catalog test, while its main binder interaction suite and general CI PASS. Investigate and resolve before declaring a fully green release. https://github.com/jin345-byte/kaseys-binder-studio/pull/7 and https://github.com/jin345-byte/kaseys-binder-studio/actions/runs/39269611753
- **Five essentials:** (1) Preserve production database, OAuth sessions, and KBS-CLOUD-1 snapshots. (2) Treat older deployment documentation and the legacy staging-ui-auth-test workflow as potentially stale; the main entrypoint now is a Cloudflare Worker with assets and D1. (3) Read actual Chromium logs, not only green "Binder Studio CI" checks. (4) Maintain exact-size artwork/print geometry and the intentionally rolled-back L-shape overlay behavior. (5) Test realistic 29,656-card catalog/bootstrap, desktop/tablet/mobile overflow, and 11-page navigation after any UI change.

No real user/cloud data was written as part of this handoff. The live production and preview sites could not be browsed directly from this audit environment; the October 19 CI published-site result is a narrower, separately labeled source of evidence.

## 2. Product overview and end-to-end workflows

**Supported feature inventory:** Search cards by Pokémon/Trainer; browse and filter printing variants by set and artist; card hover preview/details; dynamic card image fallbacks; browse/upload/URL-add external artwork; move and crop artwork across binder pockets; 2x2 (4), 3x3 (9), 4x3 (12) binder layouts; artwork dimensions including 1x1, 2x1, 1x2, 3x1, 2x2, 3x3, and L-shaped artwork; binder/page/sleeve colors; selectable visual themes; binders with many pages; switch, save, duplicate/reorder/view/present pages where exposed by feature modules; guest persistence; optional Google sign-in/cloud sync; current-page/all-pages artwork tile printing; normal exact-size insert print.

**Search and place:** Open Cards tab, enter a Pokémon or Trainer, optionally pick a set and artist, browse resulting cards, drag one into an empty pocket on desktop (mobile supports tap-based alternative per HISTORICAL handoff). Set selection should show an entire set in collector-number order rather than a silently capped fraction. When a catalog result is absent, the client can use live proxied card search. Card images should keep stable high/low or proxy fallbacks.

**Customize a page:** Choose 4/9/12-pocket layout, set binder/page/sleeve colors, open Artwork tab, select an automatically fetched image or add an HTTPS image/upload, choose size/footprint, place it, and adjust cropping or offsets. Multi-pocket L art spans three occupied pockets and leaves the fourth corner available; preserve the currently approved "bleeding overlay" visual semantics and occupied-pocket calculations rather than reviving superseded experimental clipping.

**Save/load and binder organization:** "My binders" supports new binder, new page, rename, delete, select/view/edit. Editor state uses localStorage plus IndexedDB binder/page snapshots. Signed-in users can use Google authentication and cloud synchronization; guest mode is local-first, and first sign-in can import guest work. This path needs careful cross-device/large-payload verification before any sync changes.

**Print:** "Print inserts" makes a CSS millimeter-sized print sheet; optional Cards toggle includes normal card images. Artwork spans s.columns × 70 mm by s.rows × 95 mm; ordinary cards occupy 63 × 88 mm centered within those 70 × 95 mm cells. The normal print page explicitly instructs 100% / Actual size with Fit to page disabled and preserves crop position. "Current page tiles" prints artwork tiles on the active page; "All pages tiles" prints tile sets from all pages. Real printer scaling/cutting fidelity is NOT proved by browser-only tests. For Michi-style binder inserts the historical requirement is artwork-only printing unless Cards is opted in, not a screenshot of entire card/binder UI.

**Accounts:** Worker endpoints include GET /api/config, GET /api/me, POST /api/auth/google, POST /api/logout, GET /api/sync, PUT /api/sync. It uses a secure HttpOnly session cookie; the Google ID token is verified server-side. Guest users need no account.

**What is intentionally not a feature:** The product is not identified as a marketplace, checkout/payment system, automated card-grading service, or sales-inventory manager in the current UI or prior scope. An authoritative explicit product exclusion list from Nelson is UNKNOWN; do not invent feature commitments.

## 3. Architecture, stack and repository map

**Stack:** Browser HTML/CSS, plain JavaScript (no package.json and no established JS framework/build pipeline at main), IndexedDB and localStorage; Cloudflare Workers serving public/ static PWA assets and JSON APIs; Cloudflare D1 (SQLite) for account/session/snapshot records; Google OAuth client-side identity plus Worker verification; Playwright + Node 22 tests on GitHub Actions; service worker currently designed to unregister/no fetch interception in the production-compatible preview. Source contains layered feature overrides; script load order and cache-busting query parameters matter.

**Hosting reality:** The main wrangler.jsonc names Worker kaseys-binder-studio, main src/worker.js, directory ./public, asset binding ASSETS, and production D1 binding DB. src/worker.js imports src/prod-preview-worker.js for selected GET image/card/art APIs; authenticated production writes stay in src/worker.js. The README.md and DEPLOYMENT.md still describe a Cloudflare Pages main-branch deploy and Chrome-extension-origin workflow with baseline v2.6.0: these are STALE relative to checked v4.0.5 Worker configuration. Whether Cloudflare automatically deploys production via Git integration is UNKNOWN. Do not infer that Git push alone will publish; validate Cloudflare deployment history and binding config first.

**Repo map (main):**
- public/index.html: runtime build version, HTML shell, full UI control IDs, ordered scripts/styles.
- public/app.js: core editor, card fetching/local models, binder local persistence, old theme hooks, page render, print sheet generator.
- public/style.css and public/styles/*: base shell, responsive/visual overrides; page-rail-structural-fix.css implements new wrapping page grid; mobile-lab.css and layout-overlap-fixes.css affect responsive boundaries.
- public/features/production-v405.js: current production feature loader and page navigation runtime; must be read with public/index.html.
- public/features/prebuilt-catalog-bootstrap.js and public/catalog/manifest.json plus cards-001.json through cards-008.json: bundled catalog loading, in-memory activation and asynchronous IndexedDB persistence.
- public/features/production-card-flow-fix.js, card-variants-panel-v2.js, searchable-filters.js, cards-lab.js, catalog-lab.js: search, filtering, variants, dynamic API, card rendering and images.
- public/features/artwork-l-shapes.js, artwork-legacy-repair.js, art-search-lab.js, art-source-links.js, binder-cover-designer.js: artwork sourcing/composition, special footprints, data migrations, cover editor.
- public/features/card-tile-print-scope.js: print active-page/all-pages tile options and popup handling.
- public/features/cloud-sync.js, data-safety.js: guest-to-cloud snapshot, revision/hash conflict logic and data safeguards.
- public/features/guided-tour-finish.js, guided-tour-auto-library.js, guided-tour-step16-fix.js, help-lab.js: onboarding/walkthrough overlays; legacy timing is fragile.
- public/features/page-switch-card-browser-preserve.js and performance-core.js: selective page rendering and preserving card-browser scroll.
- src/worker.js: production auth/sync, /api/card-image proxy, delegated read APIs; src/prod-preview-worker.js: production-compatible read-only preview; src/staging-worker.js: older staging/feed logic.
- migrations/0001_auth_sync.sql: Cloudflare D1 tables for users, sessions, binder snapshots.
- public/privacy.html and public/terms.html: standalone existing policy pages (not absent); footer/navigation links are absent from current public/index.html.
- tests/binder-smoke.cjs: isolated extensive Playwright cases across responsive viewports; tests/prebuilt-catalog-smoke.cjs: large fresh-install fixture; tests/production-readonly.cjs: live guest-only smoke.
- .github/workflows/*.yml: seven workflow definitions on current main; many more historical definitions reside on other branches.
- wrangler.jsonc: production binding; wrangler.prod-preview.jsonc ONLY on prod-db-compat-preview; wrangler.staging.jsonc on old staging branch, not main. Treat configs as environment-specific and do not copy blindly between branches.

**Storage/data:** localStorage includes michiStandaloneState, active binder/page IDs and sync baseline keys. Browser IndexedDB includes kaseyMasterCardIndex (schema v6) and binder/page stores. Cloud snapshots use format KBS-CLOUD-1, optional gzip-base64, revision check/merge logic, and a conservative 1,850,000-byte cap in Worker. D1 actual table names: users, sessions, binder_snapshots. Files or screenshots are not automatically uploaded as separate R2 objects; large uploaded data URLs can exceed D1 row limits.

**Catalog:** manifest at main, generated 2026-09-17 19:39 UTC, schema 2, version 641f650f5224, 29,656 cards: English Pokémon 20,635; Pokémon Pocket 2,480; Union Arena 6,541; 264 sets; eight hashed JSON chunks. Manifest sources explicitly name PokemonTCG/pokemon-tcg-data, TCGdex, and HanClinto/tcgjson + TCGplayer CDN. Other runtime sources include pokemontcg.io/Scrydex image URLs, Pokémon species (PokeAPI), fan-art APIs (Safe Donmai/Safebooru/Zerochan) and Cloudflare API proxies. Catalog generation provenance and update cadence on current main are UNKNOWN; older build-card-catalog workflow exists on historical branches, not one of the seven main workflows. Never imply card prices or card images are licensed/accurate without verifying provenance and terms.

## 4. How to work in the repository

**Checkout and setup:**
    git clone https://github.com/jin345-byte/kaseys-binder-studio.git
    cd kaseys-binder-studio
    git checkout main
    git rev-parse HEAD

There is no package.json on inspected main. There is no framework production build command; public/ already contains deployable assets. Node.js 22 is used in CI. Playwright dependency is installed ad hoc by the Chromium workflow:
    npm install --no-save playwright@1.55.0
    npx playwright install --with-deps chromium
    node tests/binder-smoke.cjs
    node tests/prebuilt-catalog-smoke.cjs
    node tests/production-readonly.cjs

Use a local static HTTP server for no-Worker UI inspection (for example, python3 -m http.server 8788 --directory public); the Worker APIs are not supplied by a static server. Use a local Wrangler development server for API integration only with a clearly isolated LOCAL D1 DB; never supply --remote or execute migrations against production while experimenting. The production Worker deployment syntax from AUTH-SYNC-SETUP is:
    npx wrangler deploy --config wrangler.jsonc
It has live-production effects; **do not execute without Nelson's explicit approval and preflight validation**. Preview branch deploy syntax is:
    git checkout prod-db-compat-preview
    npx wrangler deploy --config wrangler.prod-preview.jsonc
This preview has the production D1 binding but must remain read-only at Worker API and application levels. Older isolated staging flow uses staging-ui-auth-test, wrangler.staging.jsonc, and a distinct staging D1; it is not the current production-compatible preview. No currently verified CI/CD autopromotion path to production is established.

**Static checks:** Use node --check on public JS; module syntax checks with node --input-type=module --check < src/worker.js; check public/index.html local src/href references; validate wrangler.jsonc; run all three browser scripts; verify real logged-in behavior on a safely isolated staging account, never production customer data.

**Branch and PR norms:** observed practice is issue-focused fix/, audit/, perf/, feature/ branches and named backup/ rollback anchors, PR into main, with changeset/behavior described and status evidence. Formal naming/approval/commit message policy is UNKNOWN. Do not merge when browser checks fail without written exception and acceptance coverage. Keep rollback branch before risky changes and annotate tested SHA. Do not force-push main or erase backups. Examples: backup/main-before-production-search-drag-fix-2026-09-27; backup-prod-preview-before-performance-optimization-2026-09-10; backup-prod-preview-after-readonly-hardening-2026-09-15.

**Current main GitHub Actions workflows (7):**
1. binder-browser-regression.yml, on PR to main or manual: install Chromium, tests/binder-smoke.cjs, prebuilt-catalog-smoke.cjs, best-effort production-readonly.cjs, upload artifacts. **FAIL** on PR #7 head 287596aa... (run 39269611753), because prebuilt smoke timed out at line 49 (20-second page.waitForFunction). Other major binder cases PASS. This workflow does not automatically run on a merge push to main.
2. ci.yml, on push to main, PR and manual: syntax and file references, critical production hooks, reject retired staging assets, validate Wrangler. **PASS** for main 8cbb63ac (run 39270722896); PASS for PR #7 head (run 39269611873). This is static/sanity CI, not an end-to-end certificate.
3. build-staging-art-cache.yml, manual: checks out *legacy* staging-ui-auth-test; crawls PokeAPI/Safe Donmai, commits cache onto that staging branch, deploys to old staging Worker, browser-checks artwork/library. **Last successful/failed current run UNKNOWN**; not relevant to prod-compatible preview without review.
4. deploy-staging.yml, manual: checks out staging-ui-auth-test and applies migrations to separate staging D1 before deployment. **Last status on main definition UNKNOWN**; older branch Deploy Staging run 39271908282 succeeded October 19, but is not production preview.
5. test-art-image-proxy.yml, manual: deploys isolated test Worker and validates proxied image bytes in Chromium. **Latest result UNKNOWN.**
6. test-artwork-providers.yml, manual: probes image API providers, CORS and old staging art API. **Latest result UNKNOWN.**
7. test-staging-browser.yml, manual: Playwright probes old staging art/media and local library. **Latest result UNKNOWN.**

Other workflow files, including prod-db-compat-preview.yml and deep-preview-audit.yml, exist on historical prod-db-compat-preview branch, not on inspected main. September 18 preview run failures were recorded for staging hardening, deep preview, typography/visual, and related audits; their exact present applicability needs separate investigation. Some old pipelines fail during configuration/preflight, before browser tests. Never equate all red checks with application failures.

**What the October 19 Chromium log proves:** named 300-card search; hover suppression and intentional hover; pointer drag into pocket; full set uncapped; two-page live API 262-printing pagination; stale request isolation; L-shape three-pocket geometry; current/all tile print; saved binder round-trip; eleven-page grid and navigation; boundaries at 1680x900, 1600x1000, 1280x800, 1024x768, 768x900 and 390x844; no uncaught page exception. It THEN timed out waiting for 80 Pikachu results in realistic first-install catalog test. The best-effort live-site check reported published manifest 29,656 cards, build 4.0.5-production-preview-ui, API preflight 200, 213 card search results, guest navigation PASS and no page errors. It also logged one aborted card-search request, which may be expected cancellation but merits corroboration.

## 5. Current feature state (verified versus assumed)

| Feature | State | Evidence and caveat |
| --- | --- | --- |
| Production guest shell/UI v4.0.5 | WORKS in narrow smoke | 2026-10-19 published guest Chromium run; site was not independently opened during this handoff |
| Offline bundled catalog first installation | PARTIAL / TEST FAIL | Realistic first-install fixture timed out at line 49 of tests/prebuilt-catalog-smoke.cjs; root cause UNKNOWN |
| Named Pokémon and set search, pagination | WORKS in test | Isolated browser regression PASS, published-site 213-result guest search PASS; arbitrary real sets not audited |
| Card hover, drag and placement | WORKS in test | Isolated Chromium PASS, desktop pointer test |
| Card image fallbacks | PARTIAL | Code supports proxy/fallback; complete coverage and upstream availability UNKNOWN |
| Artist filtering and normalization | PARTIAL | Native artist select exists; case/diacritic/misspelling duplicates possible; no dedup regression proof |
| Outside artwork search and upload | PRESENT / UNKNOWN reliability | Modules in source; upstream availability not verified live here |
| Multi-pocket art including L-shaped | WORKS in test | Chromium asserts three occupied pockets + free corner |
| Print current/all artwork tiles | WORKS in test | Chromium verifies 3 tiles and 6 tiles plus popup timing |
| Physical print scale and crop on paper | UNVERIFIED | Millimeter CSS and actual-size instructions in source; physical printer calibration not tested |
| Save/load across local binder pages | WORKS in test | Isolated saved page round-trip PASS |
| Google sign-in and account sync | PRESENT / UNVERIFIED end to end | Source and schema inspected; no authenticated production account/cloud write exercised |
| UI themes and appearance | PRESENT / PARTIAL | Lavender/system-sans design baseline; no complete visual device matrix |
| Page navigation, PR #7 grid | FIXED in source; TEST PASS | Merged 8cbb63ac; direct first/last page navigation, viewport checks PASS |
| Guided tour start/finish/login step | PRESENT / NOT VERIFIED | Guided tour scripts/DOM exist; finish and login step timing behavior needs manual UX test |
| Footer / About / Contact / data-source pages | INCOMPLETE | No About/Contact/data-source files or obvious index footer; privacy.html and terms.html DO exist |
| Mobile phone | TESTED PARTIALLY | Chromium 390x844 geometry/closed drawer PASS; touch-target and iOS Safari manual test UNKNOWN |
| Tablet | TESTED PARTIALLY | Chromium 768x900/1024x768 geometry PASS, compact navigation acceptable; touch UX UNKNOWN |
| Wide desktop | TESTED PARTIALLY | Chromium 1280/1600/1680 tests PASS; broad browser/device coverage UNKNOWN |

Status "WORKS in test" never implies all scenarios or production cloud flows are functional. Older September screenshots and reports may describe pre-October code.

## 6. In-flight work, PRs and branches

**PR inventory:** PR #7 is MERGED; no open PRs at observed repo query time. PR #6 (compact bubbles) preceded PR #7 and is now superseded in layout by full-width wrapping grid. PR #5 repaired browser overflow, page collision, bootstrap races and responsive controls. PR #4 introduced comprehensive card-browser/printing/browser test work. PR #3 addressed partial rendering and page switch scroll preservation. PR #2 was explicitly superseded and should not be merged. PR #1 was previously draft/scope-limited; present open-PR query returned none, so check its final closed/merged disposition if resurrecting its logic. Branches for PRs and backups remain and should not be blindly merged.

**October 19 main changes:**
- 0039ec1531425dd4fdbb269d774e133137ab3d9e (14:04 UTC): panel boundaries, tablet layout, drawer compositor, 11-page rail, first-install async catalog race fixes; general CI passed.
- da25b2db6de7c3819bed066e964a4bfe1290ac34 (14:22 UTC): compact old rail page bubbles; CI passed.
- 8cbb63acb2416d22af8eb85c937c0661e11eb5d7 (14:38 UTC): merge PR #7 full-width left-to-right wrapping numbered grid, uniform ~30px chips, remove unnecessary desktop arrows and avoid scrollIntoView vertical jumps. Production branch CI passed; Chromium branch job was red due to catalog scenario, not numbered-grid assertions.
- October 16 da89dbbd8ffecb8fae23d15b62b86053491718f7: search/hover/printing responsive regression audit and Playwright suite.

**Relevant historical branches:** prod-db-compat-preview (read-only production-D1 preview, separate from main); production-release-v4, production-pre-v4-release-2026-09-21, production-d1-backup-2026-09-21 and other 2026-09-21 promotion/rollback anchors; staging-ui-auth-test (old separate staging); fix/full-width-page-number-grid-2026-10-19; fix/compact-page-bubbles-2026-10-19; audit/mobile-layer-qa-2026-10-16; audit/full-regression-2026-10-16; perf/smooth-binder-page-switch. Many backup branches exist. At observed point main is SHA 8cbb..., prod-db-compat-preview source tree was SHA 1e1b2bf... and legacy staging-ui-auth-test had distinct later commits. Do not assume branch contents have been rebased to main.

**Half-done items outside visible repo, private working changes, current deployment drift, outstanding user acceptance:** UNKNOWN. No current pull request records them. PR #7 does not require another merge; remaining work is diagnose fresh-install test and confirm released UI parity to main.

## 7. Prioritized known issues backlog

Classification is based on verified defect evidence or historical reports; it does not imply every issue reproduces at current main. All detailed reproduction instructions below are for disposable guest/local test data, never a real production user account.

### P0 — data safety blockers for unsafe future changes
**No confirmed active P0 production data-loss incident established.** However, **any** change which modifies D1 production snapshots, schema, authentication, session tokens, or preview read-only guards without verified rollback is a release-blocking risk, not a routine styling fix. Repro/acceptance: on a separate test D1, use a saved two-binder snapshot, authenticate, sync across devices, sign out/in, check revision and all pages remain unchanged; verify preview POST/PUT/DELETE endpoints return rejection and do not mutate DB. Modules: src/worker.js, src/prod-preview-worker.js, public/features/cloud-sync.js, migrations/0001_auth_sync.sql. Known completed data-safety design: revision checks, hashed snapshots and read-only preview Worker. Production migration permissions and rollback procedure are UNKNOWN.

### P1-1 — first-install prebuilt catalog smoke times out (CONFIRMED TEST FAILURE)
Symptom: large fresh browser bootstrap test cannot reach its expected 80 Pikachu search cards within 20 seconds. Reproduce: checkout PR #7 head or current main, install Playwright, run node tests/prebuilt-catalog-smoke.cjs using new browser profile and intercepted 15,050 Pokémon + 6,200 Union Arena + 550 Pocket catalog fixture. File tests/prebuilt-catalog-smoke.cjs line 49 (waitForFunction), public/features/prebuilt-catalog-bootstrap.js, public/features/catalog-lab.js, public/features/card-variants-panel-v2.js, public/app.js. Suspected (NOT proved): slow loading/indexing, query/race or fixture normalization causing no 80 results, with stale IndexedDB request interference. Already tried: October 16/19 commits added immediate catalog activation and protection from older asynchronous DB loads; production guest smoke passed, but isolated fresh-install fixture still failed. Acceptance: 80 expected Pikachu results, full catalog >=21,250, kbsPrebuiltCatalogVersion matches fixture, exactly one navigation and no results lost after offline write, repeated 3+ fresh browser runs; capture diagnostic on failure. Log https://github.com/jin345-byte/kaseys-binder-studio/actions/runs/39269611753

### P1-2 — live release status/preview parity UNKNOWN
Symptom: version text, Git commit and actual deployed Worker/assets could disagree; main README describes Pages while current Worker config uses src/worker.js. Repro: compare served index.html, key CSS/JS files, /api/config response headers and deployed Worker history against 8cbb... using no-cache requests; compare staging preview branch separately. Modules: public/index.html, public/features/production-v405.js, wrangler.jsonc, separate preview wrangler config, Cloudflare deployment metadata. Cause: legacy docs and multiple deployment routes. Already tried: cache-busted runtime assets in PRs #4–#7 and historical preview asset checksum workflow. Acceptance: documentary record of current deployment SHA, Worker name, DNS binding, status code, asset digests and rollback; no production mutation. Do NOT assume the URL is up to date solely because code merged.

### P1-3 — artist filter names duplicated or misspelled (HISTORICAL OPEN; current status UNKNOWN)
Symptom: "Artist" dropdown may list visually duplicated spellings/case variants or source typos. Repro: populate all card sources, open artist filter, search visually identical accent/spacing/case names, select one and confirm expected printings; compare input artist names to source metadata. Module: public/app.js loadArtists() currently deduplicates raw (illustrator || artist) with case-sensitive new Set, then locale-sorts; public/features/searchable-filters.js wraps native select; catalog normalizers/ingest. Likely cause: source metadata variance and no canonical alias key (this is a code-based suspicion). Fix attempts documented: searchable dropdown and broader search normalization; there is no verified canonical artist mapping fix. Acceptance: stable canonical list and alias coverage without losing original artist/source attributions; representative set with differing case/diacritic names has one canonical option and all printings remain selectable.

### P1-4 — guided tour guest/sign-in/finish UX (HISTORICAL OPEN; verify first)
Symptom: tour may advance unexpectedly, fail to reach target, or offer confusing sign-in completion after guest walkthrough. Repro: new clean browser guest session, launch Guided Tour, navigate all 15 visible step positions, try finish, repeat, open login entry, escape/close, check editor state and focus; test mobile. Files: public/features/guided-tour-finish.js, guided-tour-step16-fix.js, guided-tour-auto-library.js, help-lab.js, guided-demo DOM in public/index.html. Suspected fragile area: multiple overlapping step/timeout and overlay control scripts; exact current manifestation UNKNOWN. Attempts: separate guided-tour-finish, step16-fix and auto-library files indicate targeted patches, but no current end-to-end verification. Acceptance: one overlay at a time, deterministic complete/cancel/restart, no unintended sign-in, preserved binder state and accessible focus/scroll on desktop/mobile.

### P1-5 — cloud/account snapshot limits and guest conversion (UNVERIFIED integration risk)
Symptom: large uploaded-image snapshot may exceed D1 row limit; account merge/guest conversion could select wrong copy under conflict. Repro: on isolated test account/DB create multiple pages with sizable image payloads; test import, two-device edit conflict, reconnect, signout/in, and preview read-only response. Modules: public/features/cloud-sync.js, data-safety.js, src/worker.js. Suspected limitations: 1,850,000-byte cap and gzip support, no R2 binary store; not a confirmed new bug. Tried: KBS-CLOUD-1 snapshot validation, hashes, revision checks, merge and gzip. Acceptance: graceful explicit over-limit failure, no partial overwrite, deterministic conflict resolution, correct revision, no production DB mutation.

### P2-1 — missing integrated footer/About/Contact/data-source disclosures
Symptom: application shell lacks footer/navigation to brand/about/contact/source transparency. Repro: load public/index.html, inspect bottom of page and navigation. Existing: public/privacy.html and public/terms.html DO exist, so do not re-create them as "missing"; the index entry does not link them. Missing About/contact/data-source pages are not found in checked main tree. Modules: public/index.html, styles and existing policy pages. Attempts: standalone privacy/terms written Aug 31; integration remains incomplete. Acceptance: accessible footer links to working About, Contact, Privacy, Terms and Data Sources pages, mobile-friendly; owner validates legal copy and sourcing details. No unsupported legal claims.

### P2-2 — page grid regression/scroll behavior (FIXED IN CODE, VERIFY LIVE)
Historical symptom: numbered bubbles clipped/overlap library sidebar, narrow vertical page rail, scrollIntoView jumps viewport. Repro historical: add 11 pages, test 1680/1600/1280/1024/768/390 widths, click first/last page. Changes: 0039ec..., da25b2..., 8cbb63ac PR #7; now 30px left-to-right wrapping full-width desktop grid, mobile original horizontal behavior. Isolated Chromium grid/boundary assertions PASS; live deployed parity UNKNOWN. Acceptance: 11+ page controls never clip, reachable at all widths, page nav does not jump document, no selected/appearance overlap. Do not reinstate old vertical-scrolling page-rail CSS.

### P2-3 — transient card imagery/API fallback (MONITOR)
Symptom: some card thumbnails may fail because upstream hosts block, redirect or omit an image; one aborted card-search request in live read-only smoke. Repro: search old/new English/Union Arena/Pocket sets and image hosts; check browser image naturalWidth, API status, cancellation logic and retries. Modules: src/worker.js /api/card-image, src/staging-worker.js, production-card-flow-fix.js, catalog/art-image code. Attempts: allowlisted proxy, image fallback arrays, search cancellation, cache-busting. Acceptance: no broken images where supported card images exist, user-friendly explicit fallback otherwise; no stale results overwriting new query; only approved HTTPS hosts and no open proxy. The logged aborted request alone is not a confirmed defect.

## 8. Decisions log, fragile areas, do-not-redo list

- Production release is v4.0.5; older staging branch UI is not the canonical production interface. Historical approved style: default Lavender theme, retain saved selection, System Sans readability-first, calm rounded controls, no intrusive decorative glow/pulse or title/page-number motion. Check current source before forcing defaults; old app.js includes fallback Jolteon hooks that later loaders override.
- Desktop page navigation was deliberately converted from a vertical rail to a full-width wrapping grid in PR #7; 30px chips, no global scrollIntoView jump, mobile behavior preserved. Do not revert to old rail or add duplicate navigation.
- Search must return full filtered set/card printing results, not arbitrary 150/250 cap. Preserve multi-page live API lookup, request cancellation and scroll position when pages change or cards are placed.
- Exact-size print uses CSS mm; a printed artwork insert is not just a screenshot. Preserve cropX/cropY and physical footprint; verify 100% scale and print pop-up behavior. Do not add "fit to page" scaling as default.
- L-shaped artwork current approved behavior is deliberately a bleeding overlay occupying three pockets, not a forced four-pocket square or a previously reverted clipping approach. Historically a proposed constrained L renderer was rolled back in commit f536f1acb897479622f891858458a7d08bbe7f68.
- Local-first guest mode, opt-in Google cloud sync and KBS-CLOUD-1 snapshot shape are compatibility commitments. Avoid uncontrolled migration or IndexedDB version bump.
- No production D1 changes, migrations, schema changes, auth/OAuth changes, worker replacement, cloud-snapshot rewrite, or production deployments as part of a styling/testing fix without explicit authorization, backup and staged proof.
- Do not disable the existing read-only guard on prod-db-compat-preview just to make sign-in look active. The preview is not a safe test bed for writing to the production D1.
- Do not revive old staging-ui-auth-test as the source of truth, merge backup branches by default, use stale README baseline version, or trust only static CI.
- Fragile areas: layered script/style injection and cache busting, IndexedDB race during prebuilt bootstrap, index rebuilding after API rows arrive, binder-save/page-switch overlap, Google sync revision merges, overlay/drawer z-index, and printer popup timing.

## 9. Access and services inventory (credential NAMES ONLY)

- **GitHub**: jin345-byte/kaseys-binder-studio; Actions and branch/PR control. GitHub Actions secrets referenced by workflows: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID. Do not output values.
- **Cloudflare Workers**: production kaseys-binder-studio; production-compatible preview kaseys-binder-studio-prod-preview; legacy isolated staging kaseys-binder-studio-staging. Binding names: ASSETS and DB. Confirm deployment/DNS association in Cloudflare UI; automatic deployment integration UNKNOWN.
- **Cloudflare D1**: production database named kaseys-binder-studio-db, staging database named kaseys-binder-studio-staging-db. Never use UUID identifiers from a different environment.
- **Google identity**: public Worker variable GOOGLE_CLIENT_ID; Google OAuth Web application permitted origins and token verification in Worker. No Google client secret used in documented flow; verify current deployment setting.
- **Artwork and card providers**: catalog sources PokemonTCG/pokemon-tcg-data; TCGdex; HanClinto/tcgjson; TCGplayer CDN; runtime PokeAPI, api.pokemontcg.io or app card-search proxy, Scrydex/card images, Safebooru/Safe Donmai, Zerochan. Worker config also refers to ZEROCHAN_USERNAME as a nonsecret variable. Credentials for card API, if required at some provider, UNKNOWN; do not claim they exist or reveal their values.
- **DNS / TLS / domain**: binderstudio.cc; DNS ownership, Cloudflare account identity, custom route, expiration, Cloudflare Analytics usage, R2 configuration, billing/quotas, exact hosting deployment trigger and contact inbox: UNKNOWN.
- **Credential location**: workflow secrets in GitHub repository Actions settings; nonsecret Worker vars/bindings in environment-specific Wrangler configs; actual Cloudflare secret storage/permissions not independently audited. Never commit tokens, session cookies, OAuth credentials, database contents, or captured user snapshots to this handoff.

## 10. Open questions and first tasks for Muse

**Questions only Nelson can settle:** Is PR #7's new full-width wrapping grid approved visually on production and tablets? Which live deployment mechanism is authoritative (manual Wrangler, GitHub integration, Cloudflare deploy integration)? Is the production-compatible preview still intended to stay permanently read-only? Should direct paper-size artwork print remain the default with Cards unchecked? What company/business contact address and copy should About, Contact, Terms, Privacy, and Data Sources link to? Which artist aliases are actually seen as errors by real users? What is the agreed escalation policy for red Chromium checks? Which future product feature priorities supersede this bug/security audit? Who is authorized to migrate Google/D1 or deploy to production?

**Recommended first five tasks, in order:**
1. **Capture release parity and rollback:** verify current binderstudio.cc and preview Worker build/assets/SHA, deployed headers, D1 binding separation and rollback availability before code changes.
2. **Repair and rerun first-install Chromium test:** instrument line-49 wait to separate in-memory catalog readiness from result rendering; run ≥3 fresh profiles, full suite green.
3. **Do a no-write device matrix:** 11+ pages and 2x2/3x3/4x3, search/drag/hover/art/print/save at six Chromium viewport sizes; add Safari/phone tactile checks if available.
4. **Audit artist normalization and guided tour:** reproduce existing user-visible symptoms first, patch small isolated behavior, add regression cases, protect card counts.
5. **Complete public navigation and project docs:** add footer links, About/Contact/Data Sources as owner-approved, update README/DEPLOYMENT to distinguish Worker production, preview and deprecated staging, and document CLI without ever auto-writing production.

### Completeness checklist and explicit UNKNOWNs

- [x] §1 product, stage, release, exact main commit/date, PR #7; [ ] live preview deployment SHA/uptime UNKNOWN.
- [x] §2 verified UI features and flows; [ ] formal owner-approved "not a feature" exclusions UNKNOWN.
- [x] §3 stack, core repo files, local/D1 storage, catalog manifest/source totals; [ ] current catalog generation job/cadence and media rights UNKNOWN.
- [x] §4 workable checks/commands and seven current-main workflows; [ ] actual production auto-deploy mechanics, formal team conventions, most manual-run workflow results UNKNOWN.
- [x] §5 per-feature status with mobile/tablet/desktop test distinction; [ ] real Safari, physical printer, signed-in production sync and full image-provider availability UNKNOWN.
- [x] §6 current PR states, main October 19 commit sequence, historical important branches; [ ] unpublished/working-tree changes and exhaustive private backlog UNKNOWN.
- [x] §7 prioritized verified and historical issues with symptom/repro/code/suspected cause/attempted fixes/acceptance; [ ] current guided-tour/artist bug reproduction and complete upstream-source coverage UNKNOWN.
- [x] §8 approved historic decisions and fragile no-touch areas; [ ] additional private decisions UNKNOWN.
- [x] §9 providers, DNS, auth and secret NAMES only; [ ] Cloudflare account permissions, analytics, actual account-level secret inventory and domain configuration UNKNOWN.
- [x] §10 owner questions and prioritized next five tasks; [ ] owner decisions UNKNOWN.

**Source anchors:** GitHub main tree/config/code at 8cbb63ac; PRs #1–#7; Chromium run https://github.com/jin345-byte/kaseys-binder-studio/actions/runs/39269611753; CI https://github.com/jin345-byte/kaseys-binder-studio/actions/runs/39270722896; previous historical Kasey's Binder Studio September 15 handoff (background only). Do not treat this handoff as a fresh security audit or authenticated production sign-off.
