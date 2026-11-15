import type { ArtistType } from "./artist";

export interface AlbumType {
  _id: string;
  title: string;
  description: string;
  photoUrl: string;
  /** Populated by the API on album endpoints */
  artist: ArtistType | string;
  colors: {
    hex: string;
    percentage: number;
  }[];
}
