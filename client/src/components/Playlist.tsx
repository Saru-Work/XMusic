import { Link } from "react-router-dom";
import type { PlaylistType } from "../types/playlist";
import { ListMusic } from "lucide-react";
import { plural } from "@/lib/format";
import CoverImage from "./CoverImage";

const Playlist = ({ playlist }: { playlist: PlaylistType }) => {
  return (
    <Link
      to={`/playlist/${playlist._id}`}
      className="block w-40 shrink-0 rounded-sm p-2 text-white transition-colors hover:bg-white/10"
    >
      <CoverImage
        src={playlist.coverImage}
        alt=""
        icon={ListMusic}
        className="w-full"
      />
      <h3 className="truncate pt-2 text-sm">{playlist.title}</h3>
      <p className="text-xs text-gray-400">
        {plural(playlist.songs?.length ?? 0, "track")}
      </p>
    </Link>
  );
};

export default Playlist;
