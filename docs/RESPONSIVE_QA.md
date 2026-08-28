# Responsive and cross-surface QA

## Purpose

This pass hardens the **functional prototype**. It is not Needle's final visual-design pass.

The current typography, spacing, composition, and fallback-heavy artwork presentation are allowed to change substantially later. The guarantees below should survive that redesign.

## Viewport targets

Manual QA should cover at least these representative widths:

| Class | Representative width |
| --- | ---: |
| Narrow phone | 320–375 px |
| Large phone | 390–430 px |
| Tablet | 768–900 px |
| Laptop | 1024–1280 px |
| Wide desktop | 1440 px+ |

The CSS must not rely on one exact device size.

## Shared shell guarantees

- `Skip to content` is the first keyboard-focusable control.
- Primary navigation remains usable without hover.
- On narrow screens the nav scrolls horizontally rather than shrinking labels below a useful target size or overflowing the viewport.
- Primary nav links and other important controls target at least a 44 px interactive height.
- Links, buttons, inputs, selects, and textareas receive a visible keyboard focus outline.
- reduced-motion preference suppresses transitions/animations.
- page containers use `min-width: 0` / overflow escape hatches so long content cannot force document-level horizontal scrolling.

## Library

- Search input remains a full-width 44 px target on phones.
- Sort / Release / Listened controls are two columns on normal phone widths and fall back to one column below 480 px.
- Apply / Clear controls remain touch-sized.
- cover wall remains two columns on phone widths.
- long album titles may use two lines; long artist labels truncate rather than widening the grid.
- the album count moves below the heading on very narrow screens rather than competing with the title.

## Album detail

- artwork + identity becomes one column at phone width.
- large album/artist text can wrap even for unusually long unbroken strings.
- Favorite and Revisit labels provide touch-sized rows; the checkbox itself is not the only tappable target.
- Review textarea cannot exceed its grid column and receives keyboard focus treatment.
- Save Review is touch-sized and personal-state feedback can wrap.
- listening summary becomes two columns on phone and one column below 420 px.
- timeline rows become one column on phone.
- listening-year links are touch-sized.

## Home

- featured record becomes one column on phone.
- shelves remain two-column artwork walls on phone.
- album titles can occupy two lines without widening a shelf column.
- footer links stack on phone and remain touch-sized.
- large editorial headings have overflow escape hatches.

## Explore

- decade browsing steps down 5 → 4 → 3 → 2 columns.
- album shelf becomes two columns on phone.
- artist rows become one column on phone and remain at least 44 px tall.
- long artist names cannot widen the page.

## History

- year navigation is horizontally scrollable with edge padding on phone widths.
- year links remain touch-sized.
- year summary becomes two columns on phone.
- history album wall becomes two columns on phone.
- heading/year composition stacks on very narrow phones.

## Content stress cases

Before final visual approval, manually inspect at least:

- an unusually long album title;
- an unusually long artist name;
- a Review containing long paragraphs and an unbroken URL-like token;
- an album with many listening years;
- an album with many Full/Near-Complete sessions;
- Library with search + all supported filters active;
- empty/no-match/archive-unavailable states.

## Boundary with final design

This QA pass should **not** be used as evidence that the current interface is visually finished. Its purpose is to make the current product structure dependable while the final artwork-first Needle design is developed against enriched real data.
