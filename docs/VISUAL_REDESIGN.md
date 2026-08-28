# Visual Redesign — Archive Editorial

## Status

**Approved direction for the next Needle visual pass.**

This document turns the current visual north-star reference into an implementation system for Needle. It is a design contract, not a literal screen trace.

The current Phase 2 UI is a functional prototype. It proves data flow, navigation, query behavior, personal state, responsive structure, and accessibility. It is **not** the final Needle visual direction.

## North-star statement

Needle should feel like a **living personal music archive designed as an editorial object**: a record collection, annual, and music publication compressed into a responsive application.

The experience should be:

- artwork-dominant;
- typographically expressive;
- archival without becoming nostalgic cosplay;
- dense enough to reward browsing;
- calm enough to let album covers supply most of the color;
- highly composed on Home and History;
- systematic and fast in Library;
- obviously authored rather than assembled from generic web-app components.

A useful shorthand:

> **Contemporary music annual × personal record archive × modern web application.**

## What to take from the visual reference

### Editorial page composition

Use large, intentional regions rather than rows of generic cards. A page can contain a dominant editorial story, a compact metadata rail, a large artwork moment, dense horizontal shelves, smaller browsing modules, restrained historical graphics, and fine rules that organize the page without boxing every module.

The page should feel designed as a whole composition, not like vertically stacked components.

### Strong type contrast

The type system has three clear jobs:

- expressive serif for major editorial headlines and album identity;
- modern sans for normal reading and controls;
- small mono/condensed archival labels for years, counts, provenance, and navigation details.

Needle should preserve this contrast while avoiding novelty fonts or excessive type styles.

### Artwork as the color system

The interface remains warm neutral and restrained. Most saturation comes from album covers. Large covers, cover mosaics, shelves, and occasional asymmetric artwork groupings create the visual rhythm.

### Archival micro-language

Small labels may feel catalog-like: year, first heard, last heard, Full Plays, listening years, archive count, Music Type, release year, and Favorite/Revisit state when explicitly user-authored.

These should feel quiet and precise, never like KPI widgets.

### Density with hierarchy

Needle should not equate premium design with huge empty areas. Home, Explore, and History can be visually dense when one thing is clearly dominant, modules have distinct scale, artwork carries visual separation, text is concise, and rules/spacing stay consistent.

## What NOT to take from the reference

The reference contains elements that conflict with accepted Needle decisions. They must not be copied merely because they appear in the image.

### No persistent music player

Needle is an archive, not a player. Do not reproduce a bottom playback bar, transport controls, device picker, or playback timeline. Spotify remains the outbound playback destination.

### No fake vinyl object

Do not place a decorative vinyl disc behind album artwork. The physical-record motif is too literal and conflicts with the restrained-vintage direction.

### No unsupported format metadata

Needle does not know whether a record was heard on vinyl, CD, cassette, etc. Do not add “Top format,” format badges, or similar invented metadata.

### No fabricated taste claims

Do not generate claims such as “favorite type,” “your year was loud,” “a very good year,” or similar statements unless the underlying rule is explicit, deterministic, and documented. User-authored Favorite state is valid. Inferred favorite categories are not.

### No fake collection stamps

Avoid decorative “since 2008,” numbered archive-entry stamps, or provenance marks unless they reflect real stored data and materially improve comprehension.

### No literal imitation

Do not reproduce the exact layout, copy, album art, or composition of the reference. The design needs to become recognizably Needle.

## Visual system

### Canvas and color

Default canvas:

- warm off-white / parchment-adjacent neutral;
- not yellow, beige-heavy, or faux-aged;
- no paper texture;
- subtle tonal variation only if it remains modern.

Primary text:

- near-black / graphite;
- avoid pure-black-on-pure-white harshness.

Secondary text:

- warm gray with sufficient contrast.

Rules:

- hairline neutral dividers;
- used to organize editorial regions, not surround every card.

Accent:

- one restrained interface accent may be used for active states/links;
- album art remains the primary visible color source;
- no burgundy-led palette;
- do not default to Spotify green.

### Typography roles

#### Display serif

Use for Home feature headlines, History year headlines, Album titles in hero contexts, and major section headings where editorial emphasis is useful.

Behavior:

- high contrast but readable;
- large sizes may use tight leading and modest negative tracking;
- line breaks should feel composed rather than accidental;
- long titles must degrade gracefully.

#### UI sans

Use for album/artist labels in dense shelves, body copy, search, filters, forms, Review text, and normal navigation.

#### Archive mono / narrow utility face

Use sparingly for tiny section labels, counts, years, sort/filter labels, historical metadata, and micro-navigation. Never set long paragraphs in the archive face.

### Type scale principle

Needle should have **fewer, stronger sizes**, not many near-identical steps.

Recommended roles:

1. `display-xl` — Home/History story headline;
2. `display-lg` — Album title / major page identity;
3. `display-md` — major section title;
4. `body-lg` — short editorial description;
5. `body` — normal reading;
6. `label` — album title/artist in shelves;
7. `micro` — archival metadata.

Exact font families and values belong in the implementation issue, but the role separation is locked.

## Layout system

### Desktop grid

Use a consistent editorial grid rather than ad-hoc percentages.

Recommended base:

- 12-column content grid;
- generous but finite outer margins;
- 1px rules may align to grid columns;
- modules may span 3 / 4 / 6 / 8 / 12 columns;
- dense shelves may intentionally break the normal reading column while staying aligned to the content frame.

### Tablet

Preserve hierarchy rather than merely shrinking desktop. Featured two-column modules may remain two columns until cramped; shelves reduce columns predictably; metadata rails can move below headline/artwork.

### Mobile

Mobile should feel intentionally redesigned:

- compact top navigation;
- large artwork still matters;
- 2-column Library is acceptable;
- editorial hero becomes a deliberate vertical sequence;
- horizontal shelves are allowed when they improve browsing;
- metadata groups into concise rows instead of miniature desktop columns;
- no essential interaction depends on hover.

The accessibility/responsive guarantees from 2.11 remain requirements through the redesign.

## Global shell

### Wordmark

Needle remains the product name. The wordmark should be typographic and quiet. Do not over-brand the shell; album artwork and page composition are the identity.

### Navigation

Primary navigation remains Home, Library, Explore, History. Album is contextual.

Desktop:

- horizontal navigation;
- small but legible;
- active state via rule/weight/position rather than a pill;
- global search may appear as a utility if it remains fast and unobtrusive.

Mobile:

- compact horizontal or purpose-built mobile header;
- no permanent admin drawer;
- no tiny compressed desktop navigation.

### Global search

Search should feel like part of the archive, not a SaaS input box. An icon + understated text affordance may expand/focus into a real input. Library retains its explicit search/filter capability. Do not add a second search architecture; this is presentation over the existing D1 search contract.

## Home redesign

Home is the most composed page.

### Purpose

**Rediscover the archive.** Home should feel like opening a spread from a personal music annual, not a dashboard.

### Recommended desktop structure

1. **Editorial lead** — one dominant historical story, oversized serif headline derived from real data, one large album-artwork moment, compact evidence rail, one primary path into the relevant year/album/collection slice.
2. **The Shelf** — dense horizontal strip of covers with low chrome and a “view all” path to the underlying Library/History state.
3. **Recently revisited** — medium artwork shelf with simple supporting evidence.
4. **Worth another listen** — medium artwork shelf using an explainable stale-history rule.
5. **Browse the archive** — Music Type/decade/history modules using artwork mosaics rather than text cards.
6. **History strip** — restrained chronological visualization, years as navigation, album counts or Full Play evidence where truthful, no chart for chart’s sake.

Home should not attempt to fit all product features above the fold. The reference is useful for density, not as a checklist.

## Library redesign

Library is the functional anchor and should be visually simpler than Home.

### Primary character

**A beautifully typeset wall of records.**

Desktop:

- page identity/header much more compact than the current prototype;
- collection count is secondary;
- search/filter/sort occupy one thin control zone;
- cover wall begins quickly;
- roughly 6–8 covers across depending on viewport and artwork size;
- title + artist beneath cover;
- avoid permanent stats/badges over covers.

Controls should feel integrated into the archive: search, sort, release decade, listening year, Music Type when coverage exists, and Favorite/Revisit where useful. Avoid ecommerce-style filter panels unless needed on mobile.

Interaction:

- entire cover/label region opens Album;
- subtle hover/focus response is acceptable;
- no hover-only metadata required for operation;
- long titles may wrap to two lines rather than clipping aggressively.

## History redesign

History should become one of Needle’s signature surfaces.

### Year as editorial object

A selected year should feel like opening an annual chapter.

Recommended composition:

- oversized year;
- concise deterministic story/evidence summary;
- count of albums and Full Plays;
- first-heard vs revisited context;
- prominent records from that year;
- full year cover wall below;
- year navigator/timeline that makes moving through the archive pleasurable.

### Charts

Use only where they reveal something a cover wall cannot. Good candidates after taxonomy coverage exists include album count by year, Full Plays by year, Music Type composition across years, and first-heard vs revisited balance. Charts remain subordinate to artwork.

## Explore redesign

Explore should feel like browsing shelves in a highly organized record room.

### Music Type

Once classification coverage exists, use artwork-led category tiles/mosaics, category name, and archive count. No generic rectangular SaaS cards.

### Release decades

Use strong type + cover samples rather than plain boxes.

### Artists

Artist browse can remain more typographic, but should include artwork cues for prominent/selected artists where useful.

### Collection slices

Explainable slices may include records spanning many years, first heard in a selected year, older records discovered much later, long-unheard records, Favorites, and the Revisit queue.

## Album redesign

Album detail should feel like a digital sleeve/liner-note page.

### Hero

Priority:

1. large artwork;
2. album title;
3. artist;
4. release year / Music Type / Spotify destination;
5. quiet personal controls.

Avoid making history statistics compete with the cover.

### Personal state

Favorite, Revisit, and Review should feel authored and intimate rather than like form administration. Favorite/Revisit actions may live near album identity; Review should become a deliberate writing area lower on the page; saved state should stay quiet.

### Listening history

Use a composed history summary: First heard, Last heard, Full Plays, Near-Complete listens, listening years. Session evidence remains available but visually quieter than album identity and Review.

## Artwork behavior

Use a small set of intentional artwork roles:

- `hero` — dominant feature;
- `feature` — editorial module;
- `shelf` — medium browse tile;
- `grid` — Library/History wall;
- `micro` — tiny supporting context only when unavoidable.

Spotify album art remains square. Do not crop primary covers into arbitrary portrait/landscape cards. Editorial mosaics may crop background copies for atmosphere only when the canonical cover remains identifiable elsewhere and the treatment does not misrepresent artwork.

Loading/fallback:

- preserve square geometry;
- loading should not cause layout shift;
- fallback stays neutral and quiet;
- no generated fake cover art for missing provider artwork.

## Motion

Motion should be nearly invisible.

Allowed: subtle fade/translate for page/module entry, gentle cover hover/focus response, controlled shelf scrolling, and state transitions for search/filter panels.

Avoid parallax, decorative vinyl spinning, autoplaying carousels, large animated backgrounds, or motion that competes with artwork. Respect `prefers-reduced-motion` everywhere.

## Iconography

Use icons sparingly for search, Favorite, Revisit, external Spotify destination, and simple arrows/navigation. Use simple line icons with consistent optical weight. No pseudo-vintage pictograms and no pill enclosure by default.

## Interaction and state language

### Favorite

Explicit user-authored state only.

### Revisit

Explicit user-authored queue/reminder state, not inferred from recency.

### Review

Listener-authored text. Product language is **Review / Reviews**, even if the persistence column remains `notes`.

### Full Play

Visible **Full Play / Full Plays** counts refer only to true Full sessions. Near-Complete evidence remains separate. Do not visually relabel the combined internal `qualifying_session_count` as Full Plays.

## Content rules

Editorial copy is allowed only when explainable. Every dynamic story must have a deterministic selection rule, explicit supporting fields, a fallback when evidence is insufficient, and no inferred emotion/identity/preference unless user-authored.

Prefer factual but evocative phrasing:

- “You first heard this in 2019 and returned in four later years.”
- “Seven Full Plays across 2025–2026.”
- “Not heard since 2021.”

Avoid unsupported claims:

- “This defined your summer.”
- “Your favorite indie record.”
- “The album that changed everything.”

## Responsive acceptance rules

The redesign must retain the 2.11 structural guarantees:

- keyboard-accessible primary navigation;
- visible focus states;
- skip-to-content support;
- no horizontal page overflow;
- usable mobile search/filter controls;
- minimum practical touch targets;
- long titles/artist names/Reviews cannot break layouts;
- 2-column mobile cover walls remain legible;
- essential information cannot depend on hover;
- reduced-motion preferences respected.

## Visual acceptance checklist

A redesign PR is not complete unless all relevant answers are yes:

1. Is album artwork one of the first things the eye sees?
2. Does the page have one clear primary hierarchy?
3. Could this screen plausibly belong to Needle without seeing the logo?
4. Does it avoid generic SaaS card/grid conventions?
5. Is the vintage influence coming from typography/composition rather than props or texture?
6. Is dynamic editorial copy fully data-grounded?
7. Are UI colors quieter than the album covers?
8. Does the layout still feel intentional at phone width?
9. Are Library operations fast and obvious despite the editorial styling?
10. Does Album detail feel like an archive/sleeve rather than ecommerce product detail?
11. Does History make time feel browsable rather than merely list years?
12. Are Favorite, Revisit, Review, and Full Play semantics correct?
13. Have fake-player, fake-vinyl, fake-format, and inferred-favorite patterns been avoided?
14. Has the implementation preserved accessibility and reduced-motion behavior?

## Implementation order

Deliver the redesign as bounded stacked issues, not one giant CSS rewrite:

1. visual foundation + tokens + type roles;
2. global shell/navigation/search;
3. shared artwork/shelf/grid primitives;
4. Library redesign;
5. Album redesign;
6. History redesign;
7. Explore redesign;
8. Home redesign;
9. personal-state interaction polish;
10. cross-surface visual QA + responsive acceptance.

This keeps reusable primitives ahead of the most expressive surface.

## Final principle

> **Needle should look collected, not configured.**

The product should feel like years of music were arranged into an authored archive—not fed into a dashboard template.
