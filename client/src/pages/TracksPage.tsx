import { Music, Play } from "lucide-react";
import { useDispatch } from "react-redux";
import Song from "../components/Song";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
  primaryButton,
} from "../components/States";
import type { SongType } from "../types/song";
import type { AppDispatch } from "../store/store";
import { playQueue } from "../reducers/songSlice";
import { useApi } from "@/lib/api";

const TracksPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { data, error, loading, reload } = useApi<{ songs: SongType[] }>(
    "/songs",
  );
  const songs = data?.songs ?? [];
  return (
    <div className="min-h-full p-5">
      <PageTitle title="Tracks">
        {songs.length > 0 && (
          <button
            className={primaryButton}
            onClick={() => dispatch(playQueue({ songs }))}
          >
            <Play size={14} fill="black" /> Play all
          </button>
        )}
      </PageTitle>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : songs.length ? (
        songs.map((song) => <Song key={song._id} song={song} queue={songs} />)
      ) : (
        <EmptyState icon={Music} title="No tracks yet" />
      )}
    </div>
  );
};

export default TracksPage;
