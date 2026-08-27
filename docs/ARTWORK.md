# Album Artwork System

## Purpose

Issue 2.02 creates the reusable artwork primitive that later Library, Explore, History, Home, and Album-detail surfaces can share.

Artwork is a presentation of provider metadata, not a new source of catalog identity. Canonical Album / Spotify AlbumEdition decisions remain owned by Phase 1.

## Component

`app/components/album-artwork.tsx` exports `AlbumArtwork`.

Required identity props:

- `albumTitle`
- `artistName`

Artwork input:

- `src` — provider-hosted artwork URL or `null`

Optional presentation props:

- `scale` — `thumbnail`, `grid`, or `feature`
- `priority` — opts a genuinely prominent image out of lazy loading
- `className` — local layout hook; pages should not replace the artwork primitive's square/image behavior

## URL contract

Needle V1 uses Spotify's provider-hosted artwork reference stored by Phase 1.05.

The browser component accepts a credential-free HTTPS URL. Invalid, non-HTTPS, or missing URLs are treated as unavailable.

Needle does not:

- proxy Spotify artwork through the app;
- download it into D1;
- mirror it into R2 by default;
- invent alternate artwork when Spotify does not provide one.

If Spotify/provider artwork policy changes later, update the provider contract rather than silently copying images into a new storage system.

## Rendering

Artwork is always square (`aspect-ratio: 1`).

Semantic scales are:

- `thumbnail` — compact supporting identity
- `grid` — normal Library/collection cover
- `feature` — large editorial or Album-detail moment

The parent layout controls placement and column width. The component controls square geometry, image fit, loading behavior, and fallback behavior.

## Loading behavior

Normal collection artwork uses native browser:

```text
loading="lazy"
decoding="async"
```

A page may set `priority` only for a genuinely prominent above-the-fold record; this switches that image to eager loading. Do not mark an entire cover wall as priority.

2.02 intentionally does not adopt Next/Vercel image optimization. The current Cloudflare/vinext architecture does not need another image transformation service merely to display Spotify-hosted artwork.

## Missing and failed artwork

A missing, invalid, or failed image renders a quiet square neutral fallback with the text `Artwork unavailable`.

The fallback:

- does not generate initials, gradients, faux cover graphics, vinyl, or other simulated artwork;
- keeps album identity accessible through an explicit aria label;
- uses the same square geometry so collection layouts do not jump.

## Accessibility

When artwork is available, alt text follows:

```text
{Album title} by {Artist} album artwork
```

When unavailable, the fallback announces:

```text
{Album title} by {Artist}; artwork unavailable
```

Album/artist text must still appear as normal UI text in collection/detail layouts. Artwork alt text is not a substitute for visible album identity.

## Visual rule

The artwork component adds no permanent badges, play controls, shadows, fake sleeves, vinyl discs, or genre colors.

Album artwork should supply the visual personality. Page-level metadata and interactions belong outside the image unless a later accepted design explicitly requires an overlay.
