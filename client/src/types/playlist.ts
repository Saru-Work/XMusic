import type { SongType } from "./song";

export interface PlaylistType {
  _id: string;
  title: string;
  coverImage: string;
  user: string;
  description: string;
  songs: SongType[];
}
