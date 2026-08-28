# 2.12 — Final visual foundation, masthead, artwork states, and Home 3a

## Goal

Replace Needle’s temporary prototype visual system with the accepted final handoff and prove that system on canonical Home `3a`.

This is the first implementation PR of the final visual redesign. It should leave Needle with the permanent typography/token/masthead/artwork-state foundation plus a high-fidelity Home surface that future Library/Album/History/Explore work can reuse.

## Read first

1. `AGENTS.md`
2. `docs/START_HERE.md`
3. `docs/PRODUCT.md`
4. `docs/DECISIONS.md`
5. `docs/FINAL_VISUAL_HANDOFF.md`
6. `docs/VISUAL_IMPLEMENTATION_SEQUENCE.md`
7. `docs/RESPONSIVE_QA.md`
8. relevant Home/data docs

If earlier redesign wording conflicts with `docs/FINAL_VISUAL_HANDOFF.md`, the final handoff wins for visual implementation. Existing accepted product/data semantics still win outside the visual contract.

## Baseline

Build from the branch/commit that contains the completed 2.11 responsive/accessibility work and the final handoff docs. Do not start from stale `main` if it does not yet contain those changes.

## Scope

### A. Permanent visual foundation

- Add final color, rule, spacing, focus, artwork-state, shadow, and motion tokens to `app/globals.css`.
- Replace the temporary typography stacks with `next/font` loading:
  - Bodoni Moda — display only;
  - Archivo — UI/body;
  - IBM Plex Mono — metadata/nav/refs only.
- Encode reusable type roles instead of one-off page styling.
- Preserve the 2.11 focus-visible, reduced-motion, skip-link, overflow, keyboard, and touch-target guarantees.
- Remove/retire temporary prototype tokens only where the new system fully replaces them.

### B. Global masthead/navigation/search affordance

Implement the final shared shell before page-specific Home composition:

- sticky 84px desktop masthead;
- paper background and bottom hairline;
- Needle Bodoni wordmark left;
- centered Home / Library / Explore / History nav;
- quiet archive-search affordance right using the existing search behavior rather than creating a second backend;
- active nav uses ink + a 1.5px accent underline, never a pill;
- compact mobile four-up nav row with >=44px targets;
- no sidebar, avatar fiction, playback chrome, rounded navigation, or extra accent treatment.

### C. Shared artwork behavior needed by Home

Implement only the shared artwork contracts needed to render Home correctly and reuse later:

- square aspect-ratio reservation;
- provider/Spotify image when present;
- slot fill while loading or on image failure;
- no layout shift, spinner, shimmer, generated fake cover, or permanent cover badges;
- roles sufficient for hero, grid, shelf, and micro artwork;
- final shadows by role;
- artwork-only hover lift (`translateY(-4px)`, 0.18s ease) and reduced-motion fallback;
- global accent focus ring on artwork links.

Do not overbuild a generic design system or speculative component library.

### D. Canonical Home `3a`

Recreate the accepted Home screen faithfully using the real Needle data layer.

#### Issue bar

- left: issue number + date;
- center: current story rule in Bodoni italic;
- right: previous/next issue controls with “Turn the issue”;
- desktop dimensions/spacing from the handoff;
- mobile stacked behavior from `5a`;
- all issue-specific presentation derived from one `issueIndex` source of truth.

#### Lead templates

Implement all three authored lead templates and rotate them as a coupled issue definition:

- A — portrait + metadata rail;
- B — stacked hero + pair;
- C — full-width headline + trio.

Template, rule, issue number/date, rotating-module title, and margin note must advance together. They are not independent random axes.

Use real archive data. No hard-coded demo albums or fabricated claims.

At intermediate/mobile widths, B and C collapse into the accepted single-column A-style composition rather than squeezing desktop geometry.

#### Section II — Shelf

- horizontal artwork shelf;
- ~152px desktop items;
- x-proximity snap;
- catalog refs;
- live entry/archive counts;
- “View all” destination using existing routes.

#### Section III — Rotating module

- title and margin explanation derived from the current issue definition;
- four-column desktop grid;
- real deterministic archive slice only;
- responsive collapse consistent with the handoff.

#### Section IV — History preview

- first-heard vs returning year chart;
- scale bar height to current busiest year;
- first-heard in ink, returning in accent;
- selected-year side panel;
- click selects; hover does not preview;
- keyboard left/right changes selected year;
- links into the existing History route/state;
- preserve current Full Play semantics.

### E. Accepted scrolling behavior

Implement exactly:

- Home has one vertical snap point at the **issue bar**;
- `scroll-snap-type: y proximity`, never mandatory;
- `scroll-padding-top` equals the real 84px sticky masthead;
- no vertical snap on lower Home modules;
- shelves may use horizontal x-proximity snap;
- no vertical snapping should leak into Library/Album/History/Explore.

### F. Home states + mobile proof

For the parts touched by this issue, implement the accepted `5d` state language:

- loading = slot blocks at final geometry, no shimmer/spinner;
- local error = mono margin note, not a page replacement;
- empty archive = restrained type + single import action, no illustration;
- focus = 2px accent outline / 3px offset;
- mobile Home follows `5a`: 20px gutter, no structural 200px margin column, inline margin notes, 42px lead headline, one-column lead, two-column metadata rail, 44px targets.

## Data / product boundaries

Use existing D1/runtime contracts. This issue does not change archive membership, canonical album identity, Full/Near-Complete semantics, or PersonalAlbumState.

Required Home values must be live where data exists:

- archive record count;
- min/max archive year;
- catalog refs;
- album/artist/artwork identity;
- first-heard dates;
- Full Play evidence under current rules;
- per-year first-heard vs returning aggregates.

Editorial copy must be reproducible from stored evidence. Do not infer mood, personality, ratings, or unsupported favorite status.

If the final rotation cadence (daily/weekly/etc.) is still undecided, keep the issue-selection strategy deterministic and isolated behind one helper/config boundary. Do not hide a new product decision in component code.

## Explicitly not included

- final Library `1e` redesign;
- final Album `2a` redesign;
- full History `4a` page redesign;
- Explore `5c` redesign;
- final Mobile Library `5b` redesign;
- dark mode;
- new catalog/enrichment semantics;
- new story-rule authoring system beyond the accepted three definitions;
- playback/player UI;
- fake vinyl/physical media decoration;
- gradients, rounded cards, pill-heavy chrome, tinted cards, or decorative accent proliferation.

## Acceptance criteria

### Visual fidelity

- Home clearly matches canonical `3a`, not the earlier Archive Editorial prototype styling.
- Bodoni/Archivo/IBM Plex Mono roles are visibly distinct and used only for their intended jobs.
- Paper/ink/accent/rule values match `docs/FINAL_VISUAL_HANDOFF.md`.
- Masthead measures/behaves as specified at desktop and recomposes intentionally on mobile.
- Artwork provides nearly all visible color.
- No rounded cards, gradients, fake texture, burgundy-led UI, Spotify-green-led UI, fake vinyl, or dashboard KPI-card language.
- Desktop and mobile screenshots are included in the PR and compared against `3a` / `5a`.

### Interaction

- issue controls move one coupled `issueIndex` definition at a time;
- issue selection is deterministic, not random per load;
- Home has exactly one vertical proximity snap target at the issue bar;
- shelf horizontal snapping is usable by mouse, keyboard, and touch;
- year chart is click/keyboard selected, not hover-preview driven;
- reduced-motion removes transitions;
- all essential behavior works without hover.

### Data integrity

- no fake albums/counts/history are introduced;
- archive counts and year range are live;
- Home archive slices are deterministic and explainable;
- Full Play / returning history uses accepted stored semantics;
- provider artwork failures fall back quietly without changing geometry.

### Responsive/accessibility

- no horizontal overflow at narrow phone, large phone, tablet, standard desktop, and wide desktop test sizes;
- targets remain >=44px where required;
- keyboard traversal, skip link, focus-visible, screen-reader labels, and reduced-motion contracts from 2.11 remain intact;
- long album/artist/headline text cannot break composition.

### Validation

Before PR completion:

- lint green;
- typecheck green;
- tests green;
- production build green;
- Workers output verification green;
- D1 smoke test green;
- visual screenshots attached for desktop + mobile;
- relevant docs updated if implementation reveals a real contract change.

## Follow-on sequence

After this PR is accepted, continue the final handoff in this order without re-selecting a new visual system:

1. Library `1e`
2. Album `2a`
3. History `4a`
4. Explore `5c`
5. Mobile Library `5b` + cross-surface `5d` states
6. final cross-surface fidelity/responsive/accessibility QA with real artwork
