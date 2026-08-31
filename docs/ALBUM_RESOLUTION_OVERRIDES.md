# Album resolution review overrides

Needle keeps weak or genuinely ambiguous Spotify catalog matches in Review rather than silently choosing an album edition. A listener can persist a reviewed edition choice in a local override file without editing generated `.needle` artifacts.

## File

Default path:

```text
data/history/album-resolution-overrides.json
```

`data/history/*` is ignored by Git, so real listening-history decisions remain local/private.

Version 1 shape:

```json
{
  "version": 1,
  "overrides": [
    {
      "source_album_key": "source-key-from-album-resolution-review",
      "preferred_edition_id": "edn_spotifyAlbumId",
      "note": "Reviewed and approved the proposed standard edition.",
      "updated_at": "2026-08-31"
    }
  ]
}
```

`note` and `updated_at` are optional.

## Safety boundary

An override is intentionally narrow. Needle accepts it only when all of the following are already true in the automatic resolver output:

- the source album has a canonical identity;
- catalog confidence is `high`;
- the only review reason is `edition_selection_ambiguous`;
- the selected `preferred_edition_id` is already one of Needle's retained candidate editions for that source album.

The override mechanism cannot force a `none`/low-confidence album, a missing catalog identity, a compilation-risk decision, a competing canonical family, or an arbitrary Spotify album ID into the accepted archive. Those records remain in Review for separate investigation.

## Resolver behavior

`npm run history:resolve-albums` reads the override file by default and applies valid approvals after automatic catalog resolution. The generated canonical album becomes `accepted`, its chosen edition becomes preferred, the source link becomes resolved, and report counts are recomputed.

Use another file with:

```bash
npm run history:resolve-albums -- --overrides path/to/album-resolution-overrides.json
```

The resolver never generates or overwrites the local override file.

## Cached preview behavior

`npm run history:preview-cached` reads the same override file before Spotify enrichment and archive reconciliation. This is important because cached preview performs its own cache-only catalog resolution instead of consuming the previously generated 1.04 files directly.

It remains network-free and local-only.

## Creating approvals from the current review queue

For a review set where the human has decided to accept every high-confidence pure edition ambiguity exactly as proposed, PowerShell can create the local file from the generated review artifact:

```powershell
$review = Get-Content .\data\history\.needle\album-resolution-review.json -Raw | ConvertFrom-Json

$approved = @(
  $review |
    Where-Object {
      $_.match_confidence -eq 'high' -and
      $_.edition_ambiguity -eq $true -and
      $_.proposed_preferred_edition_id -and
      $_.review_reasons.Count -eq 1 -and
      $_.review_reasons[0] -eq 'edition_selection_ambiguous'
    } |
    ForEach-Object {
      [ordered]@{
        source_album_key      = $_.source_album_key
        preferred_edition_id = $_.proposed_preferred_edition_id
        note                 = 'Approved high-confidence edition ambiguity'
        updated_at           = (Get-Date -Format 'yyyy-MM-dd')
      }
    }
)

[ordered]@{
  version   = 1
  overrides = $approved
} | ConvertTo-Json -Depth 6 | Set-Content .\data\history\album-resolution-overrides.json -Encoding utf8

Write-Host "Wrote $($approved.Count) album resolution overrides."
```

Review the resulting file before rerunning the pipeline.

## Recommended rerun sequence

After approving the local override file:

```bash
npm run history:resolve-albums
npm run history:enrich-albums
npm run history:preview-cached
npm run db:load-preview:local
```

The Spotify enrichment cache is resumable, so already enriched albums are reused. Newly accepted preferred editions are the only additional enrichment targets.
