# Binder Studio UI control standards

Audit date: 2026-10-19. Scope: hosted editor, card/artwork browsers, binder tools and dialogs.

## Root cause

UI appearance accumulates through legacy `public/style.css`, feature CSS, themes, accessibility/readability patches, and the production runtime's dynamically appended stylesheets. The same control may receive conflicting `border-radius`, `font-size`, and `font-weight` declarations with `!important`, and the last stylesheet does not always win because selectors have different specificity.

A static scan across seven core stylesheets found **36 distinct border-radius values**, **21 distinct font-size expressions** and **8 distinct font-weight values**. Those are not all problems (titles/badges need different sizes), but they should not create accidental differences among equivalent buttons.

## Shared action contract

Owned by `public/styles/control-design-system.css`:

| Token | Value | Usage |
|---|---|---|
| `--kbs-action-radius` | 12px | Regular and compact action corners |
| `--kbs-action-font` | 13px | Standard action text |
| `--kbs-action-weight` | 700 | Standard action emphasis |
| `--kbs-action-line` | 1.25 | Button line height |
| `--kbs-action-height` | 42px, 44px narrow | Minimum regular action height |
| `--kbs-compact-height` | 36px | Artwork More/Search, dense action rows |
| `--kbs-compact-font` | 12px | Compact actions only |
| `--kbs-font-family` | User setting | Font picker is authoritative |

* Action text is sentence case with normal tracking.
* Controls retain their theme colors, disabled/checked/active states and functional widths.
* Search fields, selects and text inputs also share 12px corners and 13px text.
* Page-number bubbles remain circles: these are navigation indicators, not standard labeled action buttons.
* Card images, pocket crop/remove affordances, icon-only close buttons, color swatches and checkboxes remain functional exceptions.
* Avoid introducing new hard-coded button font sizes or corner radii in feature CSS. Use tokens or a small documented exception.

## Component audit inventory

| Surface | Previously inconsistent | New expected treatment |
|---|---|---|
| Command deck | Search, My binders, Guided Tour, Print inserts, tile printing and Clear used different sizes/overrides | Shared regular action typography and radius |
| Card/artwork tabs | Custom 9px tab corners and inherited fonts | 12px corners and 13px/700 text |
| Artwork search | Search art 10px with 9px radius and 34px height | Compact 12px/700, 12px corners |
| Artwork More | 28px tall with 8px radius | Compact action scale, 12px corners |
| Artwork upload/add | Mixed feature-specific text and corners | Shared regular button tokens |
| Binder dialogs | Toolbar/page buttons from separate CSS generations | Shared button type without changing modal geometry |
| Page number grid | 30px numbered circle bubbles | Intentionally preserved |
| Appearance and colors | Controls + color swatches | Preserve swatches; normalize labeled form fields |

## QA and release policy

1. Run `node tests/binder-smoke.cjs` (Playwright) with Chromium at desktop, tablet and responsive breakpoints. Inspect snapshots for collisions/overflows.
2. Run `node tests/prebuilt-catalog-smoke.cjs`, production read-only smoke, and repository CI syntax/asset reference checks.
3. Verify actual computed styles for representative action controls in both desktop and tablet layouts.
4. Change the user font choice and verify buttons/tabs/fields inherit it together.
5. Keep work on an isolated PR until checks pass; do not alter production database or user binder state during UI QA.

Future design changes should update the shared tokens before introducing independent ad hoc button styles.
