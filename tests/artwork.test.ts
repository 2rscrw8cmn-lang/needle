import { describe, expect, it } from "vitest";

import {
  albumArtworkAlt,
  albumArtworkUnavailableLabel,
  normalizeArtworkUrl,
} from "../lib/ui/artwork";

describe("album artwork helpers", () => {
  it("accepts only credential-free HTTPS artwork URLs", () => {
    expect(normalizeArtworkUrl("https://i.scdn.co/image/example")).toBe("https://i.scdn.co/image/example");
    expect(normalizeArtworkUrl("  https://i.scdn.co/image/example  ")).toBe("https://i.scdn.co/image/example");
    expect(normalizeArtworkUrl("http://i.scdn.co/image/example")).toBeNull();
    expect(normalizeArtworkUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeArtworkUrl("https://user:pass@example.com/art.jpg")).toBeNull();
    expect(normalizeArtworkUrl("not a url")).toBeNull();
    expect(normalizeArtworkUrl(null)).toBeNull();
  });

  it("builds explicit album artwork alt text", () => {
    expect(albumArtworkAlt("Kind of Blue", "Miles Davis")).toBe("Kind of Blue by Miles Davis album artwork");
  });

  it("makes the missing-artwork state accessible without pretending it is cover art", () => {
    expect(albumArtworkUnavailableLabel("Kind of Blue", "Miles Davis")).toBe(
      "Kind of Blue by Miles Davis; artwork unavailable",
    );
  });
});
