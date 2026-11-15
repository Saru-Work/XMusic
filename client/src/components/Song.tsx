import type { ReactNode } from "react";
import type { SongType } from "../types/song";
import { MonitorPlay, Pause, Play } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { playQueue, setPlaying } from "../reducers/songSlice";
import { artistOf, formatDuration } from "@/lib/format";
import LikeButton from "./LikeButton";
import SongMenu from "./SongMenu";

interface Props {
  song: SongType;
  /** The list this row belongs to; it becomes the play queue. */
  queue?: SongType[];
  /** Secondary text, e.g. the album title. Defaults to the artist name when known. */
  subtitle?: string;
  /** Extra control shown at the end of the row (e.g. a remove button) */
  action?: ReactNode;
}

const Song = ({ song, queue, subtitle, action }: Props) => {
  const dispatch = useDispatch<AppDispatch>();
  const current = useSelector((s: RootState) => s.song.song);
  const isPlaying = useSelector((s: RootState) => s.song.isPlaying);
  const isCurrent = current?._id === song._id;
  const secondary = subtitle ?? artistOf(song.artist)?.title ?? song.channel;

  function toggle() {
    if (isCurrent) {
      dispatch(setPlaying(!isPlaying));
      return;
    }
    const songs = queue ?? [song];
    const index = Math.max(
      songs.findIndex((s) => s._id === song._id),
      0,
    );
    dispatch(playQueue({ songs, index }));
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded-sm border-b border-white/10 text-sm text-white hover:bg-white/10 ${isCurrent ? "bg-white/5" : ""}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${song.title}`}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-2 py-2.5 text-left"
      >
        <span
          className={`flex w-4 justify-center ${isCurrent ? "text-amber-400" : "text-gray-500 group-hover:text-white"}`}
        >
          {isCurrent && isPlaying ? (
            <Pause size={14} fill="currentColor" />
          ) : (
            <Play size={14} fill="currentColor" />
          )}
        </span>
        <span
          className={`min-w-0 flex-1 truncate ${isCurrent ? "text-amber-400" : ""}`}
        >
          {song.title}
        </span>
        {song.source === "youtube" && (
          <span title="Plays from YouTube" className="text-gray-400">
            <MonitorPlay size={14} aria-label="Plays from YouTube" />
          </span>
        )}
        {secondary && (
          <span className="hidden w-2/5 truncate text-gray-400 sm:block">
            {secondary}
          </span>
        )}
        <span className="w-10 text-right text-xs text-gray-400 tabular-nums">
          {song.duration ? formatDuration(song.duration) : "–"}
        </span>
      </button>
      <LikeButton song={song} />
      {action}
      <SongMenu song={song} />
    </div>
  );
};

export default Song;
