export interface AlbumType {
  _id: string;
  title: string;
  description: string;
  photoUrl: string;
  user: string;
  colors: {
    hex: string;
    percentage: number;
  }[];
}
