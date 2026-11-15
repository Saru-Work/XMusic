import { useEffect, useRef, useState } from "react";
import AudioEngine from "./AudioEngine";
import YouTubeEngine, {
  type EngineEvents,
  type EngineHandle,
} from "./YouTubeEngine";
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
import { api, useApi } from "@/lib/api";
import { albumColor, artistOf, formatDuration } from "@/lib/format";
import { isYouTubeResult } from "@/lib/youtube";
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
  const engineRef = useRef<EngineHandle>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(song.duration || 0);
  const [volume, setVolume] = useState(storedVolume);
  const [failure, setFailure] = useState<string | null>(null);
  const failed = failure !== null;
  const isYouTube = song.source === "youtube" && Boolean(song.youtubeId);
  const { data } = useApi<{ album: AlbumType }>(
    song.album ? `/album/${song.album}` : null,
  );
  const album = data?.album;
  const artist = artistOf(album?.artist) ?? artistOf(song.artist);
  const hasPrev = index > 0;
  const hasNext = index < queue.length - 1;

  useEffect(() => {
    localStorage.setItem(VOLUME_KEY, String(volume));
  }, [volume]);

  // A YouTube song saved without its length: store it once the player knows it
  const needsDuration =
    isYouTube && !isYouTubeResult(song) && !song.duration && duration > 0;
  useEffect(() => {
    if (!needsDuration) return;
    api(`/songs/${song._id}/duration`, {
      method: "PATCH",
      json: { duration },
    }).catch(() => {});
    // Only once per track; `duration` is stable once known
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsDuration]);

  const engineEvents: EngineEvents = {
    onTime: setTime,
    onDuration: setDuration,
    onPlayingChange: (playing) => dispatch(setPlaying(playing)),
    onEnded: () => {
      if (hasNext) dispatch(nextSong());
      else dispatch(setPlaying(false));
    },
    onError: (message) => {
      setFailure(message);
      dispatch(setPlaying(false));
    },
  };

  function seek(value: number) {
    engineRef.current?.seek(value);
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
      className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-[4px] p-3 lg:w-72 lg:flex-nowrap lg:flex-col lg:items-stretch lg:px-8 lg:py-10"
    >
      {isYouTube ? (
        // The video has to stay visible (YouTube embed terms), so it takes
        // the place of the cover art.
        <YouTubeEngine
          ref={engineRef}
          videoId={song.youtubeId!}
          playing={isPlaying}
          volume={volume}
          className="aspect-video w-full basis-full lg:aspect-square lg:basis-auto"
          {...engineEvents}
        />
      ) : (
        <>
          <AudioEngine
            ref={engineRef}
            src={song.url}
            playing={isPlaying}
            volume={volume}
            {...engineEvents}
          />
          <CoverImage
            src={album?.photoUrl}
            alt={album ? `${album.title} cover` : ""}
            className="w-14 lg:w-full"
          />
        </>
      )}
      <div className="min-w-0 flex-1 lg:flex-none lg:text-center">
        <h2 className="truncate text-sm text-white" title={song.title}>
          {song.title}
        </h2>
        {artist ? (
          <Link
            to={`/artist/${artist._id}`}
            className="block truncate text-xs text-gray-300 hover:underline"
          >
            {artist.title}
          </Link>
        ) : (
          song.channel && (
            <p className="truncate text-xs text-gray-300">{song.channel}</p>
          )
        )}
        {failed && (
          <p role="alert" className="text-xs text-red-300">
            {failure}
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
