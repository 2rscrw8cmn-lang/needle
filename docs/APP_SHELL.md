# Application Shell

## Purpose

Issue 2.01 establishes Needle's shared product frame before artwork, Library queries, search, filters, or album detail are introduced.

This work may be developed against the sanitized Phase 1 runtime contract while the final private-history reconciliation is still pending. It does **not** change the Phase 1 real-data exit gate or fabricate product data to make the UI look finished.

## Navigation

Permanent primary navigation is:

```text
Home    Library    Explore    History
```

Album detail remains contextual and is not a permanent navigation item.

Desktop and mobile use the same four destinations. Mobile recomposes the header into two rows rather than introducing an admin-style sidebar or drawer.

## Design tokens

The token layer lives in `app/globals.css`.

### Color roles

- `--color-canvas` — warm neutral page background
- `--color-surface` — slightly lifted neutral when a future surface genuinely needs separation
- `--color-ink` — primary graphite/black text
- `--color-muted` — secondary text
- `--color-rule` — understated borders and editorial rules
- `--color-accent` — restrained neutral accent; album artwork remains the primary source of visible color

Do not introduce burgundy as a product accent and do not assign loud persistent interface colors to Music Types by default.

### Typography roles

- `--font-display` — editorial headlines and the Needle wordmark
- `--font-ui` — navigation, body copy, controls, dense browsing
- `--font-archive` — small catalog/date/status metadata

2.01 intentionally uses system/web-safe stacks. A later typography decision may replace the faces without changing these semantic roles.

### Spacing and layout

- reusable spacing tokens: `--space-1` through `--space-10`
- responsive page gutter: `--page-gutter`
- maximum composition width: `--content-max`
- readable text width: `--reading-max`

The shell is wide enough for future artwork walls while keeping editorial text constrained independently.

## Route character

### `/`

A restrained product introduction only. It does not show fake records, fake listening years, or fabricated rediscovery stories.

### `/library`

Functional collection surface. 2.01 provides only the route and hierarchy; 2.02 owns the artwork system and 2.03 owns the real cover wall/grid.

### `/explore`

Browse surface reserved for artwork-led Music Type, Genre, Artist, era, and collection-slice work in the later Explore phase.

### `/history`

Chronological surface reserved for album-art-forward history work. Charts remain secondary to record/history presentation.

## Interaction rules

- active navigation is visible but quiet;
- no essential action depends on hover;
- keyboard focus remains explicit;
- reduced-motion preferences are respected;
- no permanent player, sidebar, fake vinyl treatment, or dashboard-card system is introduced.

## Data boundary

The shell does not read the private Spotify export. Product data will come from D1 after the approved Phase 1 runtime archive is loaded.

Until the real archive is approved, UI work may use the sanitized Phase 1 runtime reference fixture for development and tests. Private listening-history data must never be committed to make a screenshot or fixture look realistic.
