"use client";

import { useEffect, useState } from "react";

import {
  albumArtworkAlt,
  albumArtworkUnavailableLabel,
  normalizeArtworkUrl,
  type ArtworkScale,
} from "../../lib/ui/artwork";

interface AlbumArtworkProps {
  src: string | null | undefined;
  albumTitle: string;
  artistName: string;
  scale?: ArtworkScale;
  priority?: boolean;
  className?: string;
}

export function AlbumArtwork({
  src,
  albumTitle,
  artistName,
  scale = "grid",
  priority = false,
  className,
}: AlbumArtworkProps) {
  const normalizedSrc = normalizeArtworkUrl(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [normalizedSrc]);

  const classes = ["album-artwork", `album-artwork--${scale}`, className].filter(Boolean).join(" ");

  if (!normalizedSrc || failed) {
    return (
      <div
        className={`${classes} album-artwork--fallback`}
        role="img"
        aria-label={albumArtworkUnavailableLabel(albumTitle, artistName)}
      >
        <span aria-hidden="true">Artwork unavailable</span>
      </div>
    );
  }

  return (
    <div className={classes}>
      <img
        className="album-artwork__image"
        src={normalizedSrc}
        alt={albumArtworkAlt(albumTitle, artistName)}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
