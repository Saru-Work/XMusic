import { History, Play } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import Song from "../components/Song";
import {
  EmptyState,
  PageTitle,
  primaryButton,
  secondaryButton,
} from "../components/States";
import type { AppDispatch, RootState } from "../store/store";
import { clearHistory, playQueue } from "../reducers/songSlice";

/** Listening history. Kept in this browser, so it also works when logged out. */
const RecentPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const songs = useSelector((s: RootState) => s.song.history);
  return (
    <div className="min-h-full p-5">
      <PageTitle title="Recently Played">
        {songs.length > 0 && (
          <div className="flex gap-2">
            <button
              className={secondaryButton}
              onClick={() => {
                if (window.confirm("Clear your recently played list?"))
                  dispatch(clearHistory());
              }}
            >
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
      {songs.length === 0 ? (
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
