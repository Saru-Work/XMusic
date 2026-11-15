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
import { EmptyState, ErrorState, LoadingState } from "./States";

/**
 * YouTube matches for a search. A pasted YouTube link shows just that video
 * (which works even when the server has no YouTube API key).
 */
const YouTubeResults = ({ query }: { query: string }) => {
  const { user } = useSelector((s: RootState) => s.user);
  const linkedId = parseYouTubeId(query);
  const { data, error, loading, reload } = useApi<{
    results: YouTubeResult[];
  }>(
    linkedId
      ? `/youtube/video/${linkedId}`
      : `/youtube/search?q=${encodeURIComponent(query)}`,
  );
  const songs = (data?.results ?? []).map(youtubeResultToSong);

  return (
    <section aria-label="YouTube results">
      <h2 className="mb-2 flex items-center gap-2 text-white">
        <MonitorPlay size={16} /> From YouTube
      </h2>
      {loading ? (
        <LoadingState label="Searching YouTube…" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : songs.length === 0 ? (
        <EmptyState title={`No YouTube results for "${query}"`} />
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
