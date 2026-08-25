# Design

## Direction

**Contemporary editorial music archive with a restrained vintage influence.**

Needle should feel like a personal record archive or well-designed music publication brought into an application—not a SaaS dashboard with album covers added afterward.

The approved visual reference lives at:

`docs/reference/needle-design-inspiration.png`

It establishes **mood, hierarchy, artwork scale, typography contrast, spacing, and editorial composition**. It is not a screen to trace literally.

## Primary rule

> If album artwork can carry the visual moment, let the album artwork carry it.

Album covers are the dominant source of color and personality. Interface chrome should support them rather than compete with them.

## Visual principles

### Album art first

- use large artwork when featuring a record;
- use dense cover shelves/walls where browsing benefits from quantity;
- allow different artwork scales in editorial surfaces;
- avoid decorating every cover with permanent badges/buttons;
- reveal secondary metadata when it helps selection, not by default everywhere.

### Modern foundation

- light, warm neutral canvas rather than stark white;
- dark ink/graphite typography;
- restrained borders/rules;
- clean controls;
- responsive layouts without mobile feeling like a compressed desktop dashboard.

### Vintage influence: light touch only

The vintage reference should come from:

- serif editorial typography paired with a modern sans;
- small archival/catalog-style metadata;
- date labels and understated rules;
- print-like hierarchy and composition;
- slightly warm neutrals.

It should **not** come from imitation objects or retro decoration.

### Editorial asymmetry

Home and History may use:

- oversized headlines;
- one dominant cover beside smaller supporting records;
- uneven but intentional grids;
- horizontal cover shelves;
- generous open space;
- occasional small data/metadata moments supporting a story.

Library should use the same visual language while staying more systematic and efficient.

## Color

- warm/light neutral background;
- black/graphite primary text;
- muted neutral secondary text and dividers;
- at most one restrained UI accent when needed;
- album covers provide most visible color.

**Do not use burgundy as the product accent.** It was explicitly rejected during visual exploration.

Avoid assigning strong persistent interface colors to genres unless the taxonomy genuinely benefits from it; artwork should remain visually dominant.

## Typography

Use contrast, not novelty.

- **Editorial display:** expressive but readable serif for major stories/headlines.
- **UI/body:** clean modern sans for navigation, metadata, controls, and dense browsing.
- **Archival metadata:** small sans or mono may be used sparingly for catalog/date information.

Do not make every album title serif merely to look vintage.

## Interaction style

- quiet, fast, direct;
- no gratuitous animation;
- subtle motion for selection/transition only;
- hover may add metadata on desktop but cannot be required to operate the app;
- album cards should open cleanly on tap;
- filters should be available without permanently surrounding the library with controls.

## Page character

### Home

Most expressive/editorial surface.

Use the listener's real history to create a few high-value visual stories. Avoid a grid of dashboard cards.

### Library

Most functional surface.

- artwork wall/grid is primary;
- search is immediate;
- common filters stay lightweight;
- advanced filters can expand on demand;
- dense browsing must remain legible.

### Explore

Collection browsing by Music Type, Genre, Artist, decade, etc. Prefer artwork mosaics/shelves over generic category cards.

### History

Chronology first, analysis second. Use album covers to represent periods and charts sparingly for trends that are genuinely clearer quantitatively.

### Album

Should feel closer to a record sleeve/liner-note composition than a product-detail ecommerce page.

Primary visual hierarchy:

1. artwork;
2. album + artist;
3. listening-history evidence;
4. metadata;
5. related records from the archive;
6. quiet “Open in Spotify” action.

## Explicit anti-patterns

Do not introduce:

- permanent left admin/dashboard sidebar;
- burgundy-heavy brand palette;
- fake vinyl records behind covers;
- turntable/needle skeuomorphism;
- paper/grain textures used as a gimmick;
- a bottom music player;
- Spotify-green primary buttons everywhere;
- excessive rounded cards/pills;
- every section enclosed in a box;
- generic KPI dashboard layouts;
- equal-sized cards everywhere on Home;
- decorative vintage icons that compete with artwork.

## Design review checklist

Before accepting a screen, ask:

1. Is album artwork clearly the star?
2. Does this look like Needle or a generic web dashboard?
3. Is the vintage influence subtle rather than literal?
4. Is there unnecessary chrome that can be removed?
5. Does the layout have purposeful hierarchy, or is everything equally important?
6. Is the Library still fast and practical?
7. Does every editorial claim come from real data?
8. Does the screen still work at phone width without reducing everything to tiny cards?
