import { useState } from "react";
import { useSelector } from "react-redux";
import { MonitorPlay } from "lucide-react";
import type { RootState } from "../store/store";
import { useApi } from "@/lib/api";
import {
  parseYouTubeId,
  youtubeResultToSong,
  type YouTubeResult,
} from "@/lib/youtube";
import Song from "./Song";
import AddToPlaylistButton from "./AddToPlaylistButton";
import { EmptyState, ErrorState, LoadingState, secondaryButton } from "./States";
import { plural } from "@/lib/format";

/**
 * YouTube matches for a search: only official uploads unless the listener
 * asks to see everything. A pasted YouTube link shows just that video
 * (which works even when the server has no YouTube API key).
 */
const YouTubeResults = ({ query }: { query: string }) => {
  const { user } = useSelector((s: RootState) => s.user);
  const linkedId = parseYouTubeId(query);
  const [showAll, setShowAll] = useState(false);
  const { data, error, loading, reload } = useApi<{
    results: YouTubeResult[];
    hidden?: number;
  }>(
    linkedId
      ? `/youtube/video/${linkedId}`
      : `/youtube/search?q=${encodeURIComponent(query)}${showAll ? "&all=1" : ""}`,
  );
  const songs = (data?.results ?? []).map(youtubeResultToSong);
  const hidden = data?.hidden ?? 0;
  const filterToggle = linkedId ? null : showAll ? (
    <p className="mb-2 text-sm text-gray-400">
      Showing every YouTube result, including edits and re-uploads.{" "}
      <button className="cursor-pointer text-white underline" onClick={() => setShowAll(false)}>
        Official only
      </button>
    </p>
  ) : hidden > 0 ? (
    <p className="mb-2 text-sm text-gray-400">
      Official uploads only: {hidden} {hidden === 1 ? "edit or re-upload" : "edits and re-uploads"} hidden.{" "}
      <button className="cursor-pointer text-white underline" onClick={() => setShowAll(true)}>
        Show all
      </button>
    </p>
  ) : null;

  return (
    <section aria-label="YouTube results">
      <h2 className="mb-2 flex items-center gap-2 text-white">
        <MonitorPlay size={16} /> From YouTube
      </h2>
      {!loading && !error && songs.length > 0 && filterToggle}
      {loading ? (
        <LoadingState label="Searching YouTube…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : songs.length === 0 ? (
        <EmptyState
          title={
            hidden > 0
              ? `No official uploads of "${query}" on YouTube`
              : `No YouTube results for "${query}"`
          }
        >
          {hidden > 0 && (
            <button className={secondaryButton} onClick={() => setShowAll(true)}>
              Show {plural(hidden, "unofficial result")}
            </button>
          )}
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
    </section>
  );
};

export default YouTubeResults;
