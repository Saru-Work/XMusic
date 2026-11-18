import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import { Disc3, ExternalLink, ListMusic, Music, Play } from "lucide-react";
import type { AppDispatch, RootState } from "../store/store";
import { playQueue } from "../reducers/songSlice";
import { useApi } from "@/lib/api";
import { plural } from "@/lib/format";
import {
  youtubeResultToSong,
  type YouTubePlaylistDetails,
} from "@/lib/youtube";
import AddToPlaylistButton from "../components/AddToPlaylistButton";
import CoverImage from "../components/CoverImage";
import Song from "../components/Song";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  iconButton,
} from "../components/States";

/** A YouTube album or playlist, played through the embedded YouTube player */
const YouTubePlaylistPage = ({ kind }: { kind: "album" | "playlist" }) => {
  const { playlistId } = useParams();
  const { user } = useSelector((s: RootState) => s.user);
  const dispatch = useDispatch<AppDispatch>();
  const { data, error, loading, reload } = useApi<YouTubePlaylistDetails>(
    `/youtube/playlist/${encodeURIComponent(playlistId ?? "")}`,
  );

  if (loading) return <LoadingState label="Loading from YouTube…" />;
  if (error || !data) {
    return (
      <ErrorState
        message={error ?? "YouTube playlist not found."}
        onRetry={reload}
      />
    );
  }

  const { playlist } = data;
  const songs = data.results.map(youtubeResultToSong);
  const hidden = playlist.itemCount - songs.length;

  return (
    <div className="min-h-full text-white">
      <div className="flex flex-col gap-5 bg-linear-to-r from-[rgba(255,255,255,0.2)] to-[rgba(255,255,255,0.05)] p-5 sm:flex-row sm:items-end">
        <CoverImage
          src={playlist.thumbnail}
          alt={`${playlist.title} cover`}
          icon={kind === "album" ? Disc3 : ListMusic}
          className="w-40 shadow-2xl"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-white/70">
            {kind === "album" ? "Album" : "Playlist"} · YouTube
          </p>
          <h1 className="wrap-break-word text-3xl md:text-5xl">
            {playlist.title}
          </h1>
          <p className="mt-2 text-sm text-white/70">
            {[playlist.channel, plural(songs.length, "track")]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <a
            className={iconButton}
            href={`https://www.youtube.com/playlist?list=${playlist.playlistId}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Open on YouTube"
            title="Open on YouTube"
          >
            <ExternalLink size={18} />
          </a>
          <button
            onClick={() => dispatch(playQueue({ songs }))}
            disabled={songs.length === 0}
            aria-label={`Play ${kind}`}
            title="Play"
            className="ml-2 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-linear-to-r from-amber-400 to-amber-700 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            <Play fill="white" size={24} className="translate-x-px" />
          </button>
        </div>
      </div>
      <div className="p-5">
        <h2 className="mb-3 text-lg">Tracks</h2>
        {songs.length === 0 ? (
          <EmptyState icon={Music} title="Nothing here can be played in XMusic">
            The videos are private, removed, or can only be watched on YouTube.
          </EmptyState>
        ) : (
          songs.map((song) => (
            <Song
              key={song._id}
              song={song}
              queue={songs}
              action={user ? <AddToPlaylistButton song={song} /> : undefined}
            />
          ))
        )}
        {songs.length > 0 && hidden > 0 && (
          <p className="mt-3 text-xs text-gray-400">
            {playlist.itemCount > 50
              ? `Showing the first ${songs.length} playable tracks of ${playlist.itemCount}.`
              : `${plural(hidden, "video")} can't be played here (private, removed or YouTube-only).`}
          </p>
        )}
      </div>
    </div>
  );
};

export default YouTubePlaylistPage;
