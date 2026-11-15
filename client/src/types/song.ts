import type { ArtistType } from "./artist";

export interface SongType {
  _id: string;
  title: string;
  url: string;
  duration: number;
  /** An id, or the populated artist on endpoints that include it */
  artist: ArtistType | string | null;
  album?: string;
  /** "youtube" songs play through the embedded YouTube player */
  source?: "upload" | "youtube";
  youtubeId?: string;
}
