# Information Architecture

## Primary navigation

Needle should begin with five product surfaces:

```text
Home    Library    Explore    History    Album (detail route)
```

Album is reached contextually rather than needing to occupy equal permanent navigation space.

No permanent admin-style sidebar is required.

## Route model

The exact framework syntax is deferred, but the conceptual route structure is:

```text
/
/library
/explore
/history
/album/:albumId
```

Optional collection/filter states should use shareable URL state where practical rather than becoming separate feature pages.

## Home

Purpose: **rediscover**.

Possible modules, all driven by real data:

- From Your History — one strong featured record/story;
- Recently Revisited;
- Worth Another Listen;
- From This Time in Your History;
- a notable listening era/year;
- one Music Type/Genre shelf;
- records spanning multiple periods.

Home should not attempt to show every capability at once.

## Library

Purpose: **find and inspect**.

### Default state

- album cover wall/grid;
- album + artist identification;
- immediate search;
- simple sort;
- lightweight top-level Music Type browsing once enriched.

### Filters

Expandable/secondary filter controls may include:

- Music Type;
- Genre;
- Artist;
- release decade/year;
- listening year/period;
- listening evidence/classification;
- Favorite/Revisit once app state exists.

Filters should combine and remain visible enough that the user understands the current collection slice.

### Sorting candidates

- recently heard;
- first heard;
- artist;
- album;
- release date;
- most revisited;
- most listening time.

Final V1 set should be selected after data-query costs are known.

## Explore

Purpose: **browse without a precise target**.

Primary sections:

### Music Type

Broad Needle taxonomy. Category views should lead with artwork and collection count, not a generic text card.

### Genre

Detailed/multi-valued taxonomy. Search/filter should accommodate overlapping genre labels.

### Decades / release era

Browse records based on original/canonical release date.

### Artists

Alphabetical and/or collection prominence views.

### Collection slices

Data-supported groupings such as:

- records first heard in a period;
- records repeatedly revisited across years;
- older records discovered much later;
- strong historical records not heard recently.

These slices must remain explainable from stored data.

## History

Purpose: **understand the archive over time**.

### Year/period navigation

A listener should be able to choose a listening year and see:

- qualifying albums from that period;
- prominent/repeated records;
- new-to-history records vs revisits;
- Music Type/Genre mix once enrichment is available;
- restrained quantitative context.

### Cross-time views

- first/last album evidence;
- records that span many years;
- repeat-listening frequency;
- Music Type/Genre trend views;
- defined listening eras.

History should remain album-art-forward even when charts are present.

## Album detail

Purpose: **remember one record and continue exploring**.

Recommended hierarchy:

1. large artwork;
2. album / artist / release metadata;
3. listening-history summary;
4. session/evidence timeline;
5. personal state (Favorite/Revisit/notes if enabled);
6. related records from the listener's own archive;
7. Open in Spotify.

### Historical evidence display

The UI should translate technical classifications into understandable language without hiding uncertainty.

Examples:

- “Listened front-to-back 4 times” when Full evidence supports it;
- “Nearly complete listen” for Near-complete sessions;
- “Appears in your history” for sparse evidence if surfaced;
- catalog/edition uncertainty only when it affects trust or the Spotify destination.

Do not expose raw database jargon unnecessarily.

## Global search

V1 search should at minimum search:

- album title;
- artist.

Genre/Music Type searching may be added if the indexing model makes it natural, but browsing/filtering already covers that need.

## Mobile behavior

Needle is not desktop-only.

- navigation should collapse cleanly without turning into an admin drawer;
- artwork remains large enough to matter;
- two-column album grids are acceptable when labels remain legible;
- editorial Home modules should stack/recompose rather than merely shrink;
- filter controls may use a focused sheet/panel on small screens;
- no essential information may depend on hover.
