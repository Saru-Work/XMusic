import { MicVocal } from "lucide-react";
import type { ArtistType } from "../types/artist";
import { Link } from "react-router-dom";
import CoverImage from "./CoverImage";

const Artist = ({ artist }: { artist: ArtistType }) => {
  return (
    <Link
      to={`/artist/${artist._id}`}
      className="block w-40 shrink-0 rounded-sm p-2 text-white transition-colors hover:bg-white/10"
    >
      <CoverImage
        src={artist.profileUrl}
        alt=""
        icon={MicVocal}
        className="w-full rounded-full"
      />
      <h3 className="truncate py-2 text-center text-sm">{artist.title}</h3>
    </Link>
  );
};

export default Artist;
