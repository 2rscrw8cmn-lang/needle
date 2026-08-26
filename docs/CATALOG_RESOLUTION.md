# Catalog Resolution

## Purpose

Issue 1.04 converts the provisional source-album identities produced by 1.03 into two separate concepts:

- **Canonical Album** — the record Needle treats as the listener-facing album identity;
- **Spotify AlbumEdition** — a specific Spotify release/edition that may be observed, matched, preferred, or ambiguous.

The resolver is designed to work for any compatible Spotify extended-history import. The private analysis workbook is a calibration reference only and is not a runtime dependency.

## Command

After 1.01 → 1.03 have completed:

```bash
npm run history:resolve-albums
```

Live mode requires local environment variables:

```text
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
```

Optional:

```text
SPOTIFY_MARKET=US
```

Do not commit Spotify credentials. The resolver uses the Spotify **Client Credentials** flow because catalog resolution is server/local-import metadata work and does not require user playback authorization.

## Inputs

From `data/history/.needle/`:

- `sessionization-report.json`
- `provisional-albums.json`
- `album-sessions.json`
- `normalized-playback-events.json`

1.04 refuses to run when the 1.03 counts/provenance contract does not reconcile.

## Outputs

Generated private outputs remain under the ignored `.needle/` directory:

```text
canonical-albums.json
spotify-album-editions.json
album-resolution-links.json
album-resolution-review.json
album-resolution-report.json
album-resolution-report.md
spotify-resolution-cache.json
```

The cache contains public catalog metadata only. It does not contain the Spotify client secret.

## Resolution evidence

Title equality alone is never sufficient. For each provisional album, Needle can use:

1. **Observed Spotify track IDs** from the listening history. The resolver probes at most the two most frequent track IDs for that source album to discover editions actually represented in history.
2. **Spotify album search** using source artist + canonicalized album family title. Search is capped at 10 results to match the current Spotify API limit.
3. **Artist similarity** between the source artist and Spotify album artists.
4. **Title-family similarity** after conservative edition-label normalization.
5. **Track-list overlap** between locally known source tracks and candidate Spotify album tracks.

Candidates receive a deterministic score and an explicit confidence level. Provider errors or weak evidence produce Review records rather than deleting historical evidence.

## Edition-family policy

These labels may share one canonical album family while preserving their separate Spotify AlbumEdition rows:

- standard
- deluxe
- expanded
- remaster
- anniversary
- reissue

When a credible standard edition is available, it is preferred for the canonical album over those low-risk variants. The listened variant remains retained as an edition.

### Re-recordings

Re-recordings remain distinct canonical identities. Examples include labels such as:

- `Taylor's Version`
- `re-recorded`
- `re-recording`
- `new recording`

The resolver must not strip those labels and collapse them into the original recording.

### Compilations and singles

Compilation/single results are not automatically accepted as canonical album identity. A compilation with weak artist agreement is explicitly sent to Review.

## Ambiguity

A source album remains Review when any of these are true:

- no catalog candidates;
- identity evidence is too weak;
- two canonical families are effectively tied;
- two genuinely equivalent edition choices remain tied;
- compilation identity is risky;
- provider lookups fail badly enough that identity cannot be established.

Review does not erase candidate information. When a plausible canonical family exists but edition selection is ambiguous, Needle retains the candidate editions and proposed preferred edition while withholding final acceptance.

## Stable identities and reimport

Stable IDs are derived from catalog identity, not the import batch:

- Canonical Album ID: Spotify primary artist identity + normalized canonical family title;
- Spotify AlbumEdition ID: Spotify album ID.

This means reimporting the same history does not create new canonical albums merely because the import batch changed.

## Workbook calibration

Direct inspection of `spotify_album_history_analysis.xlsx` during 1.04 established that its catalog work is **MusicBrainz-grounded**, not Spotify-grounded.

Current reference:

| Workbook status | Albums |
| --- | ---: |
| Accepted standard release | 349 |
| Needs match review | 41 |
| Matched but edition ambiguous | 11 |
| Matched nonofficial catalog release | 1 |
| **Total** | **402** |

Needle therefore uses:

- **349 accepted** as the workbook resolved reference;
- **53 review** as the workbook review reference.

Needle does **not** attempt to reproduce the workbook's MusicBrainz release IDs. The final 1.04 Spotify-based counts must be compared with 349/53 and any difference documented rather than silently tuning the resolver to match.

## Fixture mode

Tests may run without Spotify credentials using a sanitized catalog fixture:

```bash
npm run history:resolve-albums -- --catalog-fixture <fixture.json>
```

Fixture data must be invented/sanitized and must not include the user's private listening history.

## 1.04 / 1.05 boundary

1.04 resolves **identity** and retains only the catalog fields needed to explain that resolution.

1.05 owns broader Spotify enrichment, including:

- artwork URL/reference;
- Spotify destination URL;
- fuller release metadata;
- artist metadata;
- detailed track metadata;
- genre when available;
- enrichment timestamps/provenance.

Keeping this boundary prevents catalog identity from depending on UI/enrichment concerns and keeps failed enrichment from destroying a valid album identity.
