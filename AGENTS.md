# AGENTS.md

## Before any work

Read, in order:

1. `docs/START_HERE.md`
2. `docs/PRODUCT.md`
3. `docs/DECISIONS.md`
4. the relevant domain doc(s)
5. the GitHub issue completely

## Working rules

- Do not invent product requirements.
- Do not silently override an Accepted decision.
- Keep work bounded to the issue.
- One meaningful issue per PR unless explicitly instructed otherwise.
- Do not scaffold deferred features “for later.”
- Do not commit secrets, IP addresses, raw private-history exports, or unnecessary personal metadata.
- Raw Spotify history is ingestion material; persist only the fields allowed by the import/data contract.
- Do not use album-title string matching as the sole canonical identity mechanism.
- Preserve Album vs AlbumEdition vs AlbumSession distinctions.
- Preserve PersonalAlbumState across reimports.
- Do not infer personal ratings, moods, emotions, or personality from listening behavior.
- Genre and Music Type must come from the accepted enrichment/taxonomy path, not ad hoc component logic.
- Editorial copy about listening history must be reproducible from stored evidence.
- Use sanitized fixtures for tests/examples.
- Update the relevant documentation when a contract changes.
- If implementation reveals a required product decision, stop at the boundary and document/propose the decision rather than burying it in code.

## Design rules

- Album artwork is the star.
- Follow `docs/DESIGN.md` and the approved reference image.
- Do not turn Needle into a generic dashboard.
- Do not introduce burgundy as the primary accent.
- No fake vinyl/turntable/player decoration.
- No persistent admin sidebar unless an accepted decision changes the IA.
- Home/History may be editorial; Library must remain fast and usable.
- Visual quality is part of acceptance criteria.

## Data rules

- Treat source history as immutable input.
- Import/reimport should be deterministic and idempotent.
- Quarantine impossible/future dates until verified.
- Preserve evidence/confidence rather than forcing uncertain rows into clean-looking identities.
- Do not promote sparse track presence into a “full album listen” without the accepted evidence rule.

## PR expectations

A PR should include:

- what changed;
- why;
- the issue/phase it belongs to;
- tests/validation performed;
- screenshots for visual work;
- data-count reconciliation for import/data work;
- documentation updates when behavior/contracts changed;
- explicit known limitations.

Do not merge visual work solely because it compiles. Compare it against the approved design direction.
