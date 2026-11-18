import { Disc3, ListMusic } from "lucide-react";
import { Link } from "react-router-dom";
import { plural } from "@/lib/format";
import type { YouTubePlaylistResult } from "@/lib/youtube";
import CoverImage from "./CoverImage";

/** Card for a YouTube album or playlist; opens it inside XMusic */
const YouTubePlaylistCard = ({
  playlist,
  kind,
}: {
  playlist: YouTubePlaylistResult;
  kind: "album" | "playlist";
}) => (
  <Link
    to={`/youtube/${kind}/${playlist.playlistId}`}
    className="block w-40 shrink-0 rounded-sm p-2 text-white transition-colors hover:bg-white/10"
  >
    <CoverImage
      src={playlist.thumbnail}
      alt=""
      icon={kind === "album" ? Disc3 : ListMusic}
      className="w-full"
    />
    <h3 className="truncate pt-2 text-sm" title={playlist.title}>
      {playlist.title}
    </h3>
    <p className="truncate text-xs text-gray-400">
      {kind === "album"
        ? playlist.channel || plural(playlist.itemCount, "track")
        : plural(playlist.itemCount, "track")}
    </p>
  </Link>
);

export default YouTubePlaylistCard;
