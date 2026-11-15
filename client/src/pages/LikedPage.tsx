import { Heart, Play } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import Song from "../components/Song";
import LoginPrompt from "../components/LoginPrompt";
import {
  EmptyState,
  LoadingState,
  PageTitle,
  primaryButton,
  secondaryButton,
} from "../components/States";
import type { AppDispatch, RootState } from "../store/store";
import { playQueue } from "../reducers/songSlice";
import { plural } from "@/lib/format";

const LikedPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, initialized } = useSelector((s: RootState) => s.user);
  const songs = useSelector((s: RootState) => s.likes.songs);
  return (
    <div className="min-h-full p-5">
      <PageTitle title="Liked Songs">
        {songs.length > 0 && (
          <button
            className={primaryButton}
            onClick={() => dispatch(playQueue({ songs }))}
          >
            <Play size={14} fill="black" /> Play all
          </button>
        )}
      </PageTitle>
      {!initialized ? (
        <LoadingState />
      ) : !user ? (
        <LoginPrompt message="Log in to keep a list of songs you like." />
      ) : songs.length === 0 ? (
        <EmptyState icon={Heart} title="No liked songs yet">
          Tap the heart on any song to save it here.
          <Link to="/tracks" className={secondaryButton}>
            Browse tracks
          </Link>
        </EmptyState>
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-400">
            {plural(songs.length, "song")}
          </p>
          {songs.map((song) => (
            <Song key={song._id} song={song} queue={songs} />
          ))}
        </>
      )}
    </div>
  );
};

export default LikedPage;
