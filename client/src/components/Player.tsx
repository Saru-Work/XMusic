import { useEffect, useRef, useState } from "react";
import AudioEngine from "./AudioEngine";
import YouTubeEngine, {
  type EngineEvents,
  type EngineHandle,
} from "./YouTubeEngine";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { SongType } from "../types/song";
import type { AlbumType } from "../types/album";
import type { AppDispatch, RootState } from "../store/store";
import {
  cycleRepeat,
  jumpTo,
  nextSong,
  prevSong,
  removeSong,
  setPlaying,
  toggleShuffle,
} from "../reducers/songSlice";
import { api, useApi } from "@/lib/api";
import { albumColor, artistOf, formatDuration, plural } from "@/lib/format";
import { isYouTubeResult } from "@/lib/youtube";
import { cn } from "@/lib/utils";
import { Slider } from "./ui/slider";
import CoverImage from "./CoverImage";
import { iconButton } from "./States";

const VOLUME_KEY = "xmusic:volume";
const SEEK_STEP = 5;

function storedVolume() {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const value = Number(raw);
    return raw !== null && value >= 0 && value <= 1 ? value : 1;
  } catch {
    return 1;
  }
}

/** Settings that outlive a single track */
interface Shell {
  /** Small screens: full-screen "now playing" view instead of the compact bar */
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  showQueue: boolean;
  setShowQueue: (show: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
}

/**
 * Layouts (same DOM, so playback never restarts when the layout changes):
 * - lg and up: a column beside the page
 * - below lg: a compact bar under the page, expandable to full screen
 */
const Player = ({ song }: { song: SongType }) => {
  const [expanded, setExpanded] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [volume, setVolume] = useState(storedVolume);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // not persisted
    }
  }, [volume]);

  // Keyed by song so position and error state reset whenever the track changes
  return (
    <Deck
      key={song._id}
      song={song}
      shell={{
        expanded,
        setExpanded,
        showQueue,
        setShowQueue,
        volume,
        setVolume,
        muted,
        setMuted,
      }}
    />
  );
};

/** True when a key press belongs to a form control rather than the player */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

const Deck = ({ song, shell }: { song: SongType; shell: Shell }) => {
  const { expanded, setExpanded, showQueue, setShowQueue } = shell;
  const { volume, setVolume, muted, setMuted } = shell;
  const dispatch = useDispatch<AppDispatch>();
  const { isPlaying, index, queue, shuffle, repeat } = useSelector(
    (s: RootState) => s.song,
  );
  const engineRef = useRef<EngineHandle>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(song.duration || 0);
  const [failure, setFailure] = useState<string | null>(null);
  const failed = failure !== null;
  const isYouTube = song.source === "youtube" && Boolean(song.youtubeId);
  const { data } = useApi<{ album: AlbumType }>(
    song.album ? `/album/${song.album}` : null,
  );
  const album = data?.album;
  const artist = artistOf(album?.artist) ?? artistOf(song.artist);
  const artistName = artist?.title ?? song.channel;
  const wraps = repeat === "all" && queue.length > 1;
  const hasPrev = index > 0 || wraps;
  const hasNext = index < queue.length - 1 || wraps;
  const level = muted ? 0 : volume;

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

  function seek(value: number) {
    const clamped = Math.max(0, Math.min(value, duration || value));
    engineRef.current?.seek(clamped);
    setTime(clamped);
  }

  function previous() {
    // Like most players: restart the track unless we are near its beginning
    if (time > 3 || !hasPrev) seek(0);
    else dispatch(prevSong());
  }

  function toggleMute() {
    if (level > 0) return setMuted(true);
    setMuted(false);
    if (volume === 0) setVolume(0.5);
  }

  const engineEvents: EngineEvents = {
    onTime: setTime,
    onDuration: setDuration,
    onPlayingChange: (playing) => dispatch(setPlaying(playing)),
    onEnded: () => {
      if (repeat === "one" || (repeat === "all" && queue.length === 1)) {
        engineRef.current?.restart();
        setTime(0);
        dispatch(setPlaying(true));
      } else if (hasNext) {
        dispatch(nextSong());
      } else {
        dispatch(setPlaying(false));
      }
    },
    onError: (message) => {
      setFailure(message);
      dispatch(setPlaying(false));
    },
  };

  // The newest handlers, for listeners that are registered only once
  const actions = {
    toggle: () => {
      if (!failed) dispatch(setPlaying(!isPlaying));
    },
    play: () => dispatch(setPlaying(true)),
    pause: () => dispatch(setPlaying(false)),
    next: () => dispatch(nextSong()),
    previous,
    seek,
    seekBy: (delta: number) => seek(time + delta),
    toggleMute,
    collapse: () => setExpanded(false),
  };
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });

  // Keyboard shortcuts: Space/K play-pause, arrows seek, Shift+N/P skip, M mute
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target) || document.querySelector('[role="dialog"]')) return;
      const onControl =
        e.target instanceof HTMLElement &&
        e.target.closest('button, a, [role="slider"], [role="menu"], [role="separator"]') !== null;
      const a = latest.current;
      const key = e.key.toLowerCase();
      if ((key === " " && !onControl) || key === "k") a.toggle();
      else if (key === "arrowright" && !onControl) a.seekBy(SEEK_STEP);
      else if (key === "arrowleft" && !onControl) a.seekBy(-SEEK_STEP);
      else if (key === "n" && e.shiftKey) a.next();
      else if (key === "p" && e.shiftKey) a.previous();
      else if (key === "m") a.toggleMute();
      else if (key === "escape") a.collapse();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Hardware media keys, headset buttons and the OS "now playing" widget
  const artwork = album?.photoUrl;
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: artistName ?? "",
      album: album?.title ?? "",
      artwork: artwork ? [{ src: artwork }] : [],
    });
  }, [song.title, artistName, album?.title, artwork]);
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => latest.current.play()],
      ["pause", () => latest.current.pause()],
      ["nexttrack", () => latest.current.next()],
      ["previoustrack", () => latest.current.previous()],
      ["seekto", (d) => d.seekTime != null && latest.current.seek(d.seekTime)],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // action not supported by this browser
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // ignore
        }
      }
    };
  }, []);
  useEffect(() => {
    if ("mediaSession" in navigator)
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // Show what's playing in the browser tab
  useEffect(() => {
    document.title = `${isPlaying ? "▶ " : ""}${song.title} · XMusic`;
    return () => {
      document.title = "XMusic";
    };
  }, [song.title, isPlaying]);

  const VolumeIcon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const repeatLabel =
    repeat === "off"
      ? "Repeat: off"
      : repeat === "all"
        ? "Repeat: all songs"
        : "Repeat: this song";
  const progress = duration ? Math.min(100, (time / duration) * 100) : 0;
  // Hidden in the compact bar, shown when expanded and always on large screens.
  // (Class names are written out in full so Tailwind can find them.)
  const fullOnlyFlex = cn(expanded ? "flex" : "hidden", "lg:flex");
  const fullOnlyBlock = cn(expanded ? "block" : "hidden", "lg:block");

  return (
    <aside
      aria-label="Now playing"
      style={{ background: `linear-gradient(${albumColor(album, 0)}, #000)` }}
      className={cn(
        "shrink-0 text-white",
        expanded
          ? "fixed inset-0 z-40 flex flex-col gap-4 overflow-y-auto p-5"
          : "relative flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden rounded-[4px] p-2",
        "lg:static lg:z-auto lg:flex lg:w-(--player-w) lg:flex-col lg:flex-nowrap lg:items-stretch lg:gap-4 lg:overflow-y-auto lg:rounded-[4px] lg:p-6",
      )}
    >
      {/* Compact bar: thin progress line along the top edge */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-0.5 bg-white/15",
          expanded && "hidden",
          "lg:hidden",
        )}
      >
        <div className="h-full bg-white" style={{ width: `${progress}%` }} />
      </div>

      {/* Full-screen view: header */}
      <div
        className={cn(
          "items-center justify-between",
          expanded ? "flex" : "hidden",
          "lg:hidden",
        )}
      >
        <button
          className={iconButton}
          onClick={() => setExpanded(false)}
          aria-label="Minimize player"
        >
          <ChevronDown size={22} />
        </button>
        <span className="text-xs uppercase tracking-wide text-white/70">
          Now playing
        </span>
        <button
          className={iconButton}
          onClick={() => dispatch(removeSong())}
          aria-label="Close player"
        >
          <X size={20} />
        </button>
      </div>

      {isYouTube ? (
        // The video has to stay visible (YouTube embed terms), so it takes
        // the place of the cover art in every layout.
        <YouTubeEngine
          ref={engineRef}
          videoId={song.youtubeId!}
          playing={isPlaying}
          volume={level}
          className={cn(
            "aspect-video w-full",
            "min-h-[200px] shrink-0",
            !expanded && "max-h-[32dvh] basis-full",
            // Wide player: keep the video from pushing the controls off-screen
            "lg:aspect-square lg:max-h-[45dvh] lg:basis-auto",
          )}
          {...engineEvents}
        />
      ) : (
        <>
          <AudioEngine
            ref={engineRef}
            src={song.url}
            playing={isPlaying}
            volume={level}
            {...engineEvents}
          />
          <CoverImage
            src={album?.photoUrl}
            alt={album ? `${album.title} cover` : ""}
            className={cn(
              expanded ? "w-full max-w-72 self-center" : "w-11",
              "lg:w-full lg:max-w-[45dvh] lg:self-center",
            )}
          />
        </>
      )}

      <div
        className={cn(
          "min-w-0",
          expanded ? "text-center" : "flex-1 cursor-pointer",
          "lg:flex-none lg:cursor-auto lg:text-center",
        )}
        onClick={(e) => {
          // Compact bar: tapping the title opens the full view
          if (!(e.target as HTMLElement).closest("a")) setExpanded(true);
        }}
      >
        <h2
          className={cn("truncate text-sm", expanded && "text-lg", "lg:text-base")}
          title={song.title}
        >
          {song.title}
        </h2>
        {artist ? (
          <Link
            to={`/artist/${artist._id}`}
            onClick={() => setExpanded(false)}
            className="block truncate text-xs text-gray-300 hover:underline"
          >
            {artist.title}
          </Link>
        ) : (
          artistName && (
            <p className="truncate text-xs text-gray-300">{artistName}</p>
          )
        )}
        {failed && (
          <p role="alert" className="text-xs text-red-300">
            {failure}
          </p>
        )}
      </div>

      <div
        className={cn(
          "items-center gap-2 text-[0.7rem] text-gray-300 tabular-nums",
          fullOnlyFlex,
        )}
      >
        <span className="w-9 text-right">{formatDuration(time)}</span>
        <Slider
          aria-label="Seek"
          value={[Math.min(time, duration || 0)]}
          max={duration || 1}
          step={1}
          disabled={failed}
          onValueChange={([value]) => seek(value)}
        />
        <span className="w-9">{formatDuration(duration)}</span>
      </div>

      <div
        className={cn(
          "flex items-center justify-center gap-1",
          expanded && "gap-4",
          "lg:gap-2",
        )}
      >
        <button
          className={cn(
            iconButton,
            shuffle && "text-amber-400 hover:text-amber-300",
            !expanded && "hidden",
            "lg:inline-flex",
          )}
          onClick={() => dispatch(toggleShuffle())}
          aria-pressed={shuffle}
          aria-label="Shuffle"
          title={shuffle ? "Shuffle: on" : "Shuffle: off"}
        >
          <Shuffle size={16} />
        </button>
        <button
          className={cn(iconButton, !expanded && "hidden sm:inline-flex")}
          onClick={previous}
          aria-label="Previous track"
          title="Previous (Shift+P)"
        >
          <SkipBack size={16} fill="currentColor" />
        </button>
        <button
          onClick={() => dispatch(setPlaying(!isPlaying))}
          disabled={failed}
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          className={cn(
            "flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 disabled:opacity-50",
            expanded && "h-14 w-14",
            "lg:h-11 lg:w-11",
          )}
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
          title="Next (Shift+N)"
        >
          <SkipForward size={16} fill="currentColor" />
        </button>
        <button
          className={cn(
            iconButton,
            repeat !== "off" && "text-amber-400 hover:text-amber-300",
            !expanded && "hidden",
            "lg:inline-flex",
          )}
          onClick={() => dispatch(cycleRepeat())}
          aria-label={repeatLabel}
          title={repeatLabel}
        >
          <RepeatIcon size={16} />
        </button>
        <button
          className={cn(iconButton, expanded && "hidden", "lg:hidden")}
          onClick={() => setExpanded(true)}
          aria-label="Open full player"
        >
          <ChevronUp size={20} />
        </button>
      </div>

      <div className={cn("items-center gap-1", fullOnlyFlex)}>
        <button
          className={iconButton}
          onClick={toggleMute}
          aria-label={level > 0 ? "Mute" : "Unmute"}
          title={level > 0 ? "Mute (M)" : "Unmute (M)"}
        >
          <VolumeIcon size={16} />
        </button>
        <Slider
          aria-label="Volume"
          value={[level]}
          max={1}
          step={0.05}
          onValueChange={([value]) => {
            setVolume(value);
            setMuted(false);
          }}
        />
        <button
          className={cn(
            iconButton,
            "ml-1",
            showQueue && "text-amber-400 hover:text-amber-300",
          )}
          onClick={() => setShowQueue(!showQueue)}
          aria-pressed={showQueue}
          aria-label="Queue"
          title="Queue"
        >
          <ListMusic size={16} />
        </button>
        <button
          className={cn(iconButton, "hidden lg:inline-flex")}
          onClick={() => dispatch(removeSong())}
          aria-label="Close player"
          title="Close player"
        >
          <X size={16} />
        </button>
      </div>

      {showQueue && (
        <section aria-label="Queue" className={fullOnlyBlock}>
          <h3 className="mb-2 text-xs uppercase tracking-wide text-white/70">
            Queue · {plural(queue.length, "song")}
          </h3>
          <ol className="space-y-0.5">
            {queue.map((item, i) => {
              const current = i === index;
              return (
                <li key={`${item._id}-${i}`}>
                  <button
                    onClick={() => {
                      if (!current) dispatch(jumpTo(i));
                    }}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-white/10",
                      current && "bg-white/10 text-amber-400",
                    )}
                  >
                    <span className="w-4 shrink-0 text-center text-xs text-gray-400 tabular-nums">
                      {current ? (
                        <Play size={12} fill="currentColor" className="text-amber-400" />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.title}</span>
                      <span className="block truncate text-xs text-gray-400">
                        {artistOf(item.artist)?.title ?? item.channel}
                      </span>
                    </span>
                    <span className="text-xs text-gray-400 tabular-nums">
                      {item.duration ? formatDuration(item.duration) : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </aside>
  );
};

export default Player;
