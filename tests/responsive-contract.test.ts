import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync("app/layout.tsx", "utf8");
const globals = readFileSync("app/globals.css", "utf8");
const nav = readFileSync("app/nav.css", "utf8");
const explore = readFileSync("app/explore/explore.module.css", "utf8");
const album = readFileSync("app/album/[albumId]/album.module.css", "utf8");
const history = readFileSync("app/history/history.module.css", "utf8");

describe("responsive structural contract", () => {
  it("keeps a keyboard skip link and visible textarea focus treatment", () => {
    expect(layout).toContain('className="skip-link"');
    expect(layout).toContain('href="#main-content"');
    expect(layout).toContain('id="main-content"');
    expect(globals).toContain("textarea:focus-visible");
  });

  it("keeps mobile primary navigation scroll-safe, three-up, and touch-sized", () => {
    expect(globals).toContain(".site-nav__link");
    expect(globals).toContain("min-height: 44px");
    expect(globals).toContain("overflow-x: auto");
    expect(globals).toContain("overscroll-behavior-inline: contain");
    expect(nav).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
  });

  it("keeps Explore archive browsing usable at narrow phone widths", () => {
    expect(explore).toContain("@media (max-width: 720px)");
    expect(explore).toContain(".archiveControls");
    expect(explore).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(explore).toContain(".archiveGrid");
    expect(explore).toContain("min-height: 44px");
  });

  it("keeps personal album controls touch-sized and Review width-bounded", () => {
    expect(album).toContain(".personalToggles label");
    expect(album).toContain("min-height: 44px");
    expect(album).toContain(".reviewField textarea");
    expect(album).toContain("max-width: 100%");
    expect(album).toContain("overflow-wrap: anywhere");
  });

  it("keeps History year navigation scrollable rather than page-breaking", () => {
    expect(history).toContain(".yearNav");
    expect(history).toContain("overflow-x: auto");
    expect(history).toContain("width: calc(100% + (var(--page-gutter) * 2))");
  });
});
