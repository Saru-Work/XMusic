import { Disc3 } from "lucide-react";
import { Link } from "react-router-dom";
import type { AlbumType } from "../types/album";
import { artistOf } from "@/lib/format";
import CoverImage from "./CoverImage";

const Album = ({ album }: { album: AlbumType }) => {
  const artist = artistOf(album.artist);
  return (
    <Link
      to={`/album/${album._id}`}
      className="block w-40 shrink-0 rounded-sm p-2 text-white transition-colors hover:bg-white/10"
    >
      <CoverImage src={album.photoUrl} alt="" icon={Disc3} className="w-full" />
      <h3 className="truncate pt-2 text-sm">{album.title}</h3>
      {artist && (
        <p className="truncate text-xs text-gray-400">{artist.title}</p>
      )}
    </Link>
  );
};

export default Album;
