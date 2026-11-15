import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { SongType } from "../types/song";
import type { AlbumType } from "../types/album";
import type { AppDispatch, RootState } from "../store/store";
import { nextSong, prevSong, setPlaying } from "../reducers/songSlice";
import { useApi } from "@/lib/api";
import { albumColor, artistOf, formatDuration } from "@/lib/format";
import { Slider } from "./ui/slider";
import CoverImage from "./CoverImage";
import { iconButton } from "./States";

const VOLUME_KEY = "xmusic:volume";

function storedVolume() {
  const value = Number(localStorage.getItem(VOLUME_KEY));
  return localStorage.getItem(VOLUME_KEY) !== null && value >= 0 && value <= 1
    ? value
    : 1;
}

// Keyed by song so position and error state reset whenever the track changes
const Player = ({ song }: { song: SongType }) => <Deck key={song._id} song={song} />;

const Deck = ({ song }: { song: SongType }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { isPlaying, index, queue } = useSelector((s: RootState) => s.song);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(song.duration || 0);
  const [volume, setVolume] = useState(storedVolume);
  const [failed, setFailed] = useState(false);
  const { data } = useApi<{ album: AlbumType }>(
    song.album ? `/album/${song.album}` : null,
  );
  const album = data?.album;
  const artist = artistOf(album?.artist) ?? artistOf(song.artist);
  const hasPrev = index > 0;
  const hasNext = index < queue.length - 1;

  // Keep the <audio> element in sync with the store
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch((err) => {
        // AbortError just means another play()/pause() superseded this one
        if (err?.name !== "AbortError") dispatch(setPlaying(false));
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, dispatch]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  function seek(value: number) {
    if (audioRef.current) audioRef.current.currentTime = value;
    setTime(value);
  }

  function previous() {
    // Like most players: restart the track unless we are near its beginning
    if (time > 3 || !hasPrev) seek(0);
    else dispatch(prevSong());
  }

  return (
    <aside
      aria-label="Now playing"
      style={{ background: `linear-gradient(${albumColor(album, 0)}, #000)` }}
      className="flex shrink-0 items-center gap-4 rounded-[4px] p-3 lg:w-72 lg:flex-col lg:items-stretch lg:px-8 lg:py-10"
    >
      <audio
        ref={audioRef}
        src={song.url}
        preload="auto"
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => {
          if (Number.isFinite(e.currentTarget.duration))
            setDuration(e.currentTarget.duration);
        }}
        onEnded={() => {
          if (hasNext) dispatch(nextSong());
          else dispatch(setPlaying(false));
        }}
        onError={() => {
          setFailed(true);
          dispatch(setPlaying(false));
        }}
      />
      <CoverImage
        src={album?.photoUrl}
        alt={album ? `${album.title} cover` : ""}
        className="w-14 lg:w-full"
      />
      <div className="min-w-0 flex-1 lg:flex-none lg:text-center">
        <h2 className="truncate text-sm text-white" title={song.title}>
          {song.title}
        </h2>
        {artist && (
          <Link
            to={`/artist/${artist._id}`}
            className="block truncate text-xs text-gray-300 hover:underline"
          >
            {artist.title}
          </Link>
        )}
        {failed && (
          <p role="alert" className="text-xs text-red-300">
            This track couldn't be played.
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-[0.7rem] text-gray-300 tabular-nums">
          <span className="w-8 text-right">{formatDuration(time)}</span>
          <Slider
            aria-label="Seek"
            value={[Math.min(time, duration || 0)]}
            max={duration || 1}
            step={1}
            disabled={failed}
            onValueChange={([value]) => seek(value)}
          />
          <span className="w-8">{formatDuration(duration)}</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-1 lg:gap-3">
        <button
          className={iconButton}
          onClick={previous}
          aria-label="Previous track"
        >
          <SkipBack size={16} fill="currentColor" />
        </button>
        <button
          onClick={() => dispatch(setPlaying(!isPlaying))}
          disabled={failed}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 disabled:opacity-50"
        >
          {isPlaying ? (
            <Pause size={16} fill="black" />
          ) : (
            <Play size={16} fill="black" className="translate-x-px" />
          )}
        </button>
        <button
          className={iconButton}
          onClick={() => dispatch(nextSong())}
          disabled={!hasNext}
          aria-label="Next track"
        >
          <SkipForward size={16} fill="currentColor" />
        </button>
      </div>
      <div className="hidden items-center gap-2 sm:flex sm:w-28 lg:w-full">
        <button
          className={iconButton}
          onClick={() => setVolume(volume > 0 ? 0 : 1)}
          aria-label={volume > 0 ? "Mute" : "Unmute"}
        >
          {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <Slider
          aria-label="Volume"
          value={[volume]}
          max={1}
          step={0.05}
          onValueChange={([value]) => setVolume(value)}
        />
      </div>
    </aside>
  );
};

export default Player;
