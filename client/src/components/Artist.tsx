import type { ArtistType } from "../types/artist";
import { Link } from "react-router";
const Artist = ({ artist }: { artist: ArtistType }) => {
  return (
    <Link to={`/artist/${artist._id}`}>
      <div className="min-w-40 text-white hover:bg-[rgba(255,255,255,0.2)] flex p-2 flex-col justify-center rounded-sm transition-all cursor-pointer">
        <img
          className="w-40 h-40 rounded-lg aspect-16/12 object-cover"
          src={artist.profileUrl}
        />
        <h2 className="font-light text-sm py-2">{artist.title}</h2>
      </div>
    </Link>
  );
};

export default Artist;
