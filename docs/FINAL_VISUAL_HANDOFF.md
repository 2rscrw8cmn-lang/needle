# Needle final visual handoff

> Status: Accepted implementation source of truth for the Phase 2 visual redesign.
>
> This document supersedes earlier visual exploration where it conflicts with `docs/VISUAL_REDESIGN.md`, `docs/DESIGN.md`, or older redesign issue wording. Product/data semantics and accepted decisions remain authoritative unless explicitly changed here.

## North star

Needle is a personal listening archive. Home is a dated **issue**: a magazine-style front page carrying an issue number/date and one authored archive story. Below the lead, the same archive is shown from three additional angles: a horizontal shelf, one rotating module, and a year-by-year history chart.

The design should feel like a contemporary music annual × personal record archive × modern web application. Album artwork supplies most visible color. The interface is restrained, square, typographic, and editorial.

## Canonical screen references

The final design handoff uses these prototype IDs as the visual reference set:

- Home: `3a` — canonical
- Album detail: `2a`
- Library: `1e`
- History: `4a`
- Explore: `5c`
- Mobile Home: `5a`
- Mobile Library: `5b`
- Empty/loading/error/focus states: `5d`

Earlier Home variants `1a`–`1d` and `2b` are superseded explorations.

The original prototype HTML is design reference only. Recreate the design in Needle’s existing Next.js + React + Tailwind/CSS environment. Do not port prototype markup or fake data structures.

## Design tokens

Add final tokens to `app/globals.css`; do not scatter hard-coded values.

### Color

| Token | Value | Role |
| --- | --- | --- |
| `paper` | `#f5f3ee` | app background; sticky masthead |
| `ink` | `#17161a` | headlines, active nav, primary text |
| `ink-2` | `#4c483f` | body copy, artist names |
| `ink-3` | `#6f6a62` | eyebrows, refs, margin notes, inactive nav |
| `accent` | `#1f5c4d` | active underline, focus ring, returning chart series |
| `slot` | `#ddd8cf` | artwork loading/fallback fill |
| `rule` | `rgba(23,22,26,0.14)` | section hairlines |
| `rule-soft` | `rgba(23,22,26,0.09)` | inner dividers |
| `rule-strong` | `rgba(23,22,26,0.24)` | issue-arrow borders |

Accent is intentionally near-silent. No gradients, tinted cards, colored buttons, or decorative accent proliferation.

### Typography

Use `next/font` and self-host the accepted Google Fonts:

- **Bodoni Moda** variable, weight 400 — display only: headlines, album titles, selected year, Needle wordmark. Italic for editorial asides/story rules.
- **Archivo** 400/500/600 — UI and body.
- **IBM Plex Mono** 400/500 — metadata only: eyebrows, catalog refs, nav, margin numerals. Uppercase with `0.14em`–`0.18em` tracking.

| Role | Desktop | Mobile | Notes |
| --- | --- | --- | --- |
| Lead headline | 72 / 88 / 104 | 42 | template A/B/C; line-height `0.88`–`0.98`; tracking `-0.025em` to `-0.035em` |
| Masthead wordmark | 26 | 22 | Bodoni; `-0.01em` tracking |
| Album title | 20–22 | 19 | Bodoni; in 4+ column dense grids use Archivo 13 |
| Body | 16 | 15 | line-height `1.6`; max-width 370–520px; pretty wrap |
| Rail value | 17–19 | 15 | Archivo above mono key at 9.5 |
| Nav / eyebrow | 11 / 10 | 10.5 | mono uppercase; `0.16em`–`0.18em` |
| Catalog ref / margin note | 9 / 9.5 | 9 | never smaller |

A font never crosses into another role.

## Spacing, shape, shadow, motion

- Desktop gutter: `56px`.
- Mobile gutter: `20px`.
- Structural desktop margin column: `200px`.
- Section rhythm: hairline + `16–34px` lead-in.
- Border radius: `0` throughout.
- No cards, container shadows, or rounded containers.
- Artwork is always square (`aspect-ratio: 1`).
- Lead hero shadow: `0 20px 46px rgba(23,22,26,0.18)`.
- Grid artwork shadow: `0 14px 32px rgba(23,22,26,0.13)`.
- Shelf thumbnails: no shadow.
- Artwork hover is the only hover motion: `translateY(-4px)` over `0.18s ease`.
- Chart fill transition: `0.18s ease`.
- Under `prefers-reduced-motion: reduce`, disable transitions.
- Global focus: `2px solid accent`, `3px` outline offset.

## Global masthead

Desktop masthead is sticky at the viewport top with `z-index: 5`, `paper` background, bottom hairline, padding `22px 56px`, and measured height `84px`.

Three zones:

1. Needle wordmark left.
2. Primary nav centered: Home / Library / Explore / History, `gap: 34px`.
3. Search affordance right: 14–16px magnifier + “Search the archive” in `ink-3`.

Active nav: `ink` plus `1.5px solid accent` bottom border and `5px` bottom padding. Inactive nav: `ink-3`.

Mobile nav becomes a four-up tab row. Each item flexes equally with `11px` vertical padding and the active item gets the accent underline. All interactive targets must be at least 44px.

## Home `3a` — canonical implementation

Home is the first surface to implement against this handoff.

### 1. Issue bar

Padding `12px 56px`, bottom hairline, mono 9.5px uppercase metadata in `ink-3`.

- Left: `Issue N° {n} · {date}`.
- Center: current story rule in Bodoni italic 14px, sentence case, no tracking.
- Right: previous/next arrows with “Turn the issue”; buttons 26×26 desktop with transparent fill and `rule-strong` border.

On mobile, the bar stacks: metadata first, story rule on its own line at 13px Bodoni italic. Arrow controls have a 44px tap target and visible button box about 44×32.

### 2. Lead

Desktop outer grid: `200px 1fr`.

The margin column carries Roman numeral `I`, live archive counts, compiled date, and the same story-rule rationale so the selection is never unexplained.

Exactly one of three lead templates renders per issue:

#### Template A — portrait + rail

- Grid: `1fr 236px 560px`.
- Headline: ~76px.
- Left column: eyebrow, headline, 58px hairline, body copy max 390px, CTA pinned low.
- Center: 5-cell metadata rail behind a left hairline, `gap: 24px`.
- Right: square hero plus title/artist and right-aligned metadata.

#### Template B — stacked + pair

- Grid: `520px 1fr`, bottom aligned.
- Headline ~88px, visually pushed low with about 130px top margin.
- Right: hero plus 260px column of two stacked square artworks.
- Metadata rail runs beneath both as a five-column row divided by `rule-soft`.

#### Template C — full headline + trio

- Full-width headline ~104px.
- Body + CTA row above a hairline.
- Three-album row beneath, `gap: 30px`.

Shared CTA: mono uppercase link. Gap grows from 12px to 18px on hover; no other decorative motion.

Between mobile and full desktop, templates B/C collapse to template A’s single-column composition rather than preserving their multi-column geometry.

Mobile lead order: eyebrow → 42px headline → square hero → body → metadata rail as two-column grid. Desktop margin column disappears and its notes become inline rules above each section.

### 3. Section II — Shelf

- Horizontal scroller.
- Item width about 152px.
- `gap: 12px`.
- `overflow-x: auto`.
- `scroll-snap-type: x proximity`.
- Items use `scroll-snap-align: start`.
- Header left: entry range such as `Entries 0101 – 0512`.
- Header right: `View all ({live archive count}) →`.
- Each item: square artwork + catalog ref in mono 9px.

### 4. Section III — rotating module

Module title and margin note are both derived from the current issue definition.

Desktop: 4-column grid, `gap: 26px`. Each cell shows square artwork, title/artist, and right-aligned catalog ref.

### 5. Section IV — history

Outer grid: `1fr 200px`, `gap: 44px`, bottom aligned.

Chart:

- one bar per year;
- `flex: 1`, `gap: 8px`;
- height 170–200px;
- bottom aligned;
- year label underneath in mono;
- height scales to the busiest year in current data;
- “First heard” uses `ink`;
- “Returning” uses `accent`;
- mono legend with 10px swatches;
- click selects a year; hover does not preview;
- left/right arrow keys move selection;
- selected bar/presentation uses `ink` and focus is visible with the accent ring.

Adjacent selected-year panel: left hairline, `Selected` mono label, Bodoni year about 56px, counts in ~13px, `Open year →`.

## Issue rotation state

Use a single `issueIndex` (`0..2`) as the source of truth. Derive all issue-specific UI from it:

- lead template;
- story rule;
- issue number;
- issue date;
- rotating-module title;
- rotating-module margin note.

Do not store these as independent mutable states.

Template and story rule rotate together as one authored unit:

- A: portrait + rail
- B: stacked + pair
- C: full-width headline + trio

Production issue choice must be deterministic and server-authored/scheduled, not random per page load. Two users loading Needle on the same day should see the same current issue. Exact cadence remains a product decision; do not bury cadence assumptions in component code.

## Scroll behavior — accepted

Do not re-litigate this interaction.

Home has exactly one vertical snap point: **the top of the issue bar**.

- Use `scroll-snap-type: y proximity`, never mandatory.
- `scroll-padding-top` must equal the real sticky masthead height (`84px` desktop).
- The snap target is the issue bar, not the lead grid.
- Lower Home sections scroll freely.
- Shelves keep horizontal `x proximity` snapping.
- Library, History, Explore, and Album detail have no vertical snapping.

## Artwork states

Artwork URLs are provider/Spotify-backed when available. Do not ship generated fake cover replacements.

- Lead hero target: ~1200px square source.
- Grid items: ~600px square source.
- Shelf: ~296px square source (2× display size).
- Loading/fallback reserves the true square and fills it with `slot`.
- No spinner or shimmer.
- Artwork loading must not cause layout shift.
- Provider-image failure uses the same quiet slot treatment.

## States

### Empty archive

Keep the masthead, one Bodoni italic explanatory line, and a single import action. No zero-state illustration.

### Loading

Use `slot` blocks at exact artwork geometry. No spinner/shimmer.

### Error

Render as a mono margin note beside the affected section. Never replace the whole page for a local section error.

### Focus

`2px solid accent`, `3px` offset on every interactive surface, including artwork tiles.

## Data boundaries

Use existing Needle runtime contracts. Do not invent a parallel mock data model.

Home needs:

- albums with catalog refs, artist, artwork URL, first-heard date;
- play/session evidence for Full Plays under existing semantics;
- per-year aggregates for album count, Full Play count, first-heard vs returning split;
- live archive count and min/max archive year.

Editorial copy must remain reproducible from stored evidence. Do not infer moods, personality, or unsupported favorites. Personal state remains user-authored.

## Surface sequence after Home

Once the foundation/masthead/Home work is accepted, continue the same locked system in this order:

1. Library `1e`
2. Album detail `2a`
3. History `4a`
4. Explore `5c`
5. Mobile Library `5b` + cross-surface states `5d`
6. Final cross-surface fidelity/responsive/accessibility QA with real artwork

Do not redesign the system independently per surface.

## Explicit non-goals

- no dark mode in this pass;
- no persistent music player;
- no fake vinyl/disc/turntable object;
- no unsupported physical-format metadata;
- no burgundy-led or Spotify-green-led palette;
- no gradients;
- no rounded cards or pill-first UI;
- no admin sidebar;
- no random client-side issue selection;
- no hover-only essential behavior;
- no redesign of accepted Full Play / archive / personal-state semantics.

## Implementation quality bar

Visual work is not complete because it compiles. PRs must include desktop and mobile screenshots and compare them directly against the canonical handoff IDs above. Preserve the structural responsive/accessibility guarantees established in 2.11.
