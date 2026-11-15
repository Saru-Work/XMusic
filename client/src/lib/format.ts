import type { AlbumType } from "../types/album";
import type { ArtistType } from "../types/artist";

/** 125 -> "2:05" */
export function formatDuration(seconds: number | undefined) {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** The API returns either an id or a populated artist document */
export function artistOf(
  value: ArtistType | string | null | undefined,
): ArtistType | null {
  return value && typeof value === "object" ? value : null;
}

/** Dominant colors are extracted on upload; older albums may have none */
export function albumColor(
  album: AlbumType | null | undefined,
  index: number,
  fallback = "#2a2a2a",
) {
  return album?.colors?.[index]?.hex ?? album?.colors?.[0]?.hex ?? fallback;
}

export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
