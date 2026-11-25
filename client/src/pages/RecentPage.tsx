import { History, Play } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import Song from "../components/Song";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
  primaryButton,
  secondaryButton,
} from "../components/States";
import type { AppDispatch, RootState } from "../store/store";
import type { SongType } from "../types/song";
import { clearHistory, playQueue } from "../reducers/songSlice";
import { showToast } from "../reducers/toastSlice";
import { api, errorMessage, useApi } from "@/lib/api";
import { discardListen } from "@/lib/listening";

/**
 * Listening history: the account's when logged in, otherwise the one kept in
 * this browser.
 */
const RecentPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, initialized } = useSelector((s: RootState) => s.user);
  const local = useSelector((s: RootState) => s.song.history);
  const { data, error, loading, setData, reload } = useApi<{ songs: SongType[] }>(
    user ? "/history" : null,
    { refreshOn: "history" },
  );
  const songs = user ? (data?.songs ?? []) : local;

  async function clear() {
    const question = user
      ? "Clear your listening history on all your devices?"
      : "Clear your recently played list?";
    if (!window.confirm(question)) return;
    try {
      if (user) {
        discardListen();
        await api("/history", { method: "DELETE" });
        setData(() => ({ songs: [] }));
      }
      dispatch(clearHistory());
    } catch (err) {
      dispatch(showToast(errorMessage(err), "error"));
    }
  }

  return (
    <div className="min-h-full p-5">
      <PageTitle title="Recently Played">
        {songs.length > 0 && (
          <div className="flex gap-2">
            <button className={secondaryButton} onClick={clear}>
              Clear
            </button>
            <button
              className={primaryButton}
              onClick={() => dispatch(playQueue({ songs }))}
            >
              <Play size={14} fill="black" /> Play all
            </button>
          </div>
        )}
      </PageTitle>
      {!initialized || loading ? (
        <LoadingState />
      ) : user && error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : songs.length === 0 ? (
        <EmptyState icon={History} title="Nothing played yet">
          Songs you listen to will show up here.
        </EmptyState>
      ) : (
        songs.map((song) => <Song key={song._id} song={song} queue={songs} />)
      )}
    </div>
  );
};

export default RecentPage;
