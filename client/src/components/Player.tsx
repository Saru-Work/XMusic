import { useEffect, useRef, useState } from "react";
import AudioEngine from "./AudioEngine";
import YouTubeEngine, {
  type EngineEvents,
  type EngineHandle,
} from "./YouTubeEngine";
import { useDispatch, useSelector } from "react-redux";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
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
  clearUpcoming,
  cycleRepeat,
  jumpTo,
  removeFromQueue,
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
import LikeButton from "./LikeButton";
import PlayerOptions from "./PlayerOptions";
import { SPEEDS, type SleepTimer } from "@/lib/playback";
import { trackEnd, trackJump, trackProgress } from "@/lib/listening";
import { showToast } from "../reducers/toastSlice";

const VOLUME_KEY = "xmusic:volume";
const SEEK_STEP = 5;
const VOLUME_STEP = 0.05;
const RATE_KEY = "xmusic:rate";

function storedRate() {
  try {
    const value = Number(localStorage.getItem(RATE_KEY));
    return SPEEDS.includes(value) ? value : 1;
  } catch {
    return 1;
  }
}

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
  volume: number;
  setVolume: (volume: number) => void;
  muted: boolean;
  setMuted: (muted: boolean) => void;
  rate: number;
  setRate: (rate: number) => void;
  sleep: SleepTimer;
  setSleep: (sleep: SleepTimer) => void;
}

interface PlayerProps {
  song: SongType;
  /**
   * The "now playing" section of the layout. The cover / video and the queue
   * are rendered into it, so they stay mounted (and keep playing) while that
   * section is resized or turned into the full Now Playing page.
   */
  panel: HTMLElement | null;
  /** True on the Now Playing page, where the panel fills the page area */
  page: boolean;
}

/**
 * The bottom bar: what's playing plus the transport controls. Clicking it
 * opens the Now Playing page.
 */
const Player = ({ song, panel, page }: PlayerProps) => {
  const [volume, setVolume] = useState(storedVolume);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(storedRate);
  const [sleep, setSleep] = useState<SleepTimer>({ kind: "off" });
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
      localStorage.setItem(RATE_KEY, String(rate));
    } catch {
      // not persisted
    }
  }, [volume, rate]);

  // Sleep timer: pause when the chosen time arrives
  useEffect(() => {
    if (sleep.kind !== "at") return;
    const timer = window.setTimeout(
      () => {
        dispatch(setPlaying(false));
        dispatch(showToast("Sleep timer: playback paused"));
        setSleep({ kind: "off" });
      },
      Math.max(0, sleep.time - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [sleep, dispatch]);

  // Not keyed by song: the audio element / YouTube player must survive track
  // changes so the next song can start in a background tab. Deck resets its
  // per-track state itself.
  return (
    <Deck
      song={song}
      panel={panel}
      page={page}
      shell={{ volume, setVolume, muted, setMuted, rate, setRate, sleep, setSleep }}
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

const Deck = ({
  song,
  panel,
  page,
  shell,
}: PlayerProps & { shell: Shell }) => {
  const { volume, setVolume, muted, setMuted } = shell;
  const { rate, setRate, sleep, setSleep } = shell;
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const { isPlaying, index, queue, shuffle, repeat } = useSelector(
    (s: RootState) => s.song,
  );
  const engineRef = useRef<EngineHandle>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(song.duration || 0);
  const [failure, setFailure] = useState<string | null>(null);
  // New track: start position, length and error state over
  const [trackId, setTrackId] = useState(song._id);
  if (trackId !== song._id) {
    setTrackId(song._id);
    setTime(0);
    setDuration(song.duration || 0);
    setFailure(null);
  }
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

  // Listening history: the song is left when another one takes its place
  useEffect(() => () => trackEnd("left"), [song._id]);
  // Time spent paused doesn't count
  useEffect(() => trackJump(), [isPlaying]);

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
  }, [needsDuration, song._id]);

  function seek(value: number) {
    const clamped = Math.max(0, Math.min(value, duration || value));
    trackJump();
    engineRef.current?.seek(clamped);
    setTime(clamped);
  }

  function previous() {
    // Like most players: restart the track unless we are near its beginning
    if (time > 3 || !hasPrev) seek(0);
    else dispatch(prevSong());
  }

  function openPage() {
    if (!page) navigate("/playing");
  }

  /** Leave the Now Playing page for wherever the listener came from */
  function closePage() {
    if (!page) return;
    if (location.key !== "default") navigate(-1);
    else navigate("/");
  }

  function toggleMute() {
    if (level > 0) return setMuted(true);
    setMuted(false);
    if (volume === 0) setVolume(0.5);
  }

  const engineEvents: EngineEvents = {
    onTime: (seconds) => {
      setTime(seconds);
      trackProgress(song, seconds, duration, rate);
    },
    onDuration: setDuration,
    onPlayingChange: (playing) => dispatch(setPlaying(playing)),
    onEnded: () => {
      trackEnd("completed");
      if (sleep.kind === "end") {
        dispatch(setPlaying(false));
        dispatch(showToast("Sleep timer: playback paused"));
        setSleep({ kind: "off" });
      } else if (repeat === "one" || (repeat === "all" && queue.length === 1)) {
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
    volumeBy: (delta: number) => {
      setVolume(Math.max(0, Math.min(1, +(level + delta).toFixed(2))));
      setMuted(false);
    },
    collapse: closePage,
  };
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });

  // Keyboard shortcuts: Space/K play-pause, left/right seek, up/down volume,
  // Shift+N/P skip, M mute
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
      else if (key === "arrowup" && !onControl) a.volumeBy(VOLUME_STEP);
      else if (key === "arrowdown" && !onControl) a.volumeBy(-VOLUME_STEP);
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
  const thumbnail = isYouTube
    ? `https://i.ytimg.com/vi/${song.youtubeId}/default.jpg`
    : album?.photoUrl;
  const color = albumColor(album, 0);

  const artistLine = artist ? (
    <Link
      to={`/artist/${artist._id}`}
      className="block truncate text-gray-300 hover:underline"
    >
      {artist.title}
    </Link>
  ) : (
    artistName && <p className="truncate text-gray-300">{artistName}</p>
  );

  // Rendered into the layout's "now playing" section (see PlayerProps.panel)
  const panelContent = (
    <div
      style={{ background: `linear-gradient(${color}, #000)` }}
      className={cn(
        "flex min-h-full flex-col gap-4 p-2 text-white lg:p-6",
        page && "p-5 lg:flex-row lg:gap-8 lg:p-8",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col gap-4",
          page && "items-center lg:flex-1 lg:justify-center",
        )}
      >
        {isYouTube ? (
          // The video has to stay visible (YouTube embed terms), so it takes
          // the place of the cover art in every layout.
          <YouTubeEngine
            ref={engineRef}
            videoId={song.youtubeId!}
            playing={isPlaying}
            volume={level}
            rate={rate}
            className={cn(
              "aspect-video min-h-[200px] w-full shrink-0",
              page
                ? "max-h-[60dvh] max-w-4xl"
                : "max-h-[30dvh] lg:aspect-square lg:max-h-[45dvh]",
            )}
            {...engineEvents}
          />
        ) : (
          <CoverImage
            src={album?.photoUrl}
            alt={album ? `${album.title} cover` : ""}
            className={cn(
              "w-full self-center",
              page ? "max-w-[min(55dvh,28rem)]" : "max-w-[45dvh]",
            )}
          />
        )}
        <div
          className={cn(
            "w-full min-w-0 text-center text-sm",
            !page && "hidden lg:block",
          )}
        >
          <h2
            className={cn("truncate text-base", page && "text-2xl font-medium")}
            title={song.title}
          >
            {song.title}
          </h2>
          {artistLine}
          {album && (
            <Link
              to={`/album/${album._id}`}
              className="block truncate text-xs text-gray-400 hover:underline"
            >
              {album.title}
            </Link>
          )}
          <LikeButton song={song} size={18} className="mt-1" />
        </div>
        {/* Small screens: the bar has no room for these, so the page shows them */}
        {page && (
          <div className="flex w-full flex-col gap-2 md:hidden">
            <div className="flex items-center gap-2 text-[0.7rem] text-gray-300 tabular-nums">
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
            <div className="flex items-center justify-center gap-4">
              <button
                className={cn(
                  iconButton,
                  shuffle && "text-amber-400 hover:text-amber-300",
                )}
                onClick={() => dispatch(toggleShuffle())}
                aria-pressed={shuffle}
                aria-label="Shuffle"
              >
                <Shuffle size={18} />
              </button>
              <button
                className={iconButton}
                onClick={previous}
                aria-label="Previous track"
              >
                <SkipBack size={18} fill="currentColor" />
              </button>
              <button
                className={cn(
                  iconButton,
                  repeat !== "off" && "text-amber-400 hover:text-amber-300",
                )}
                onClick={() => dispatch(cycleRepeat())}
                aria-label={repeatLabel}
              >
                <RepeatIcon size={18} />
              </button>
              <button
                className={iconButton}
                onClick={toggleMute}
                aria-label={level > 0 ? "Mute" : "Unmute"}
              >
                <VolumeIcon size={18} />
              </button>
              <PlayerOptions
                className="sm:hidden"
                rate={rate}
                onRate={setRate}
                sleep={sleep}
                onSleep={setSleep}
              />
            </div>
          </div>
        )}
      </div>
      <section
        aria-label="Queue"
        className={cn(
          !page && "hidden lg:block",
          page && "lg:w-96 lg:shrink-0 lg:self-stretch lg:overflow-y-auto",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs uppercase tracking-wide text-white/70">
            Queue · {plural(queue.length, "song")}
          </h3>
          {index < queue.length - 1 && (
            <button
              className="cursor-pointer rounded-full px-2 py-0.5 text-xs text-gray-300 hover:bg-white/10 hover:text-white"
              onClick={() => dispatch(clearUpcoming())}
              title="Remove the songs after this one"
            >
              Clear upcoming
            </button>
          )}
        </div>
        <ol className="space-y-0.5">
          {queue.map((item, i) => {
            const current = i === index;
            return (
              <li key={`${item._id}-${i}`} className="group flex items-center">
                <button
                  onClick={() => {
                    if (!current) dispatch(jumpTo(i));
                  }}
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-white/10",
                    current && "bg-white/10 text-amber-400",
                  )}
                >
                  <span className="w-4 shrink-0 text-center text-xs text-gray-400 tabular-nums">
                    {current ? (
                      <Play
                        size={12}
                        fill="currentColor"
                        className="text-amber-400"
                      />
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
                {!current && (
                  <button
                    className={cn(
                      iconButton,
                      "p-1.5 opacity-60 group-hover:opacity-100 focus-visible:opacity-100",
                    )}
                    onClick={() => dispatch(removeFromQueue(i))}
                    aria-label={`Remove ${item.title} from queue`}
                    title="Remove from queue"
                  >
                    <X size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );

  return (
    <aside
      aria-label="Player"
      title={page ? undefined : "Open Now Playing"}
      style={{ background: `linear-gradient(90deg, ${color}, #181818 45%)` }}
      onClick={(e) => {
        // Anywhere on the bar that isn't a control opens the Now Playing page
        const control = (e.target as HTMLElement).closest(
          'button, a, input, [role="slider"], [role="group"]',
        );
        if (!control) openPage();
      }}
      className={cn(
        "relative grid shrink-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 rounded-[4px] px-3 py-2 text-white",
        "md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] md:gap-x-6 md:px-4",
        !page && "cursor-pointer",
      )}
    >
      {panel && createPortal(panelContent, panel)}
      {!isYouTube && (
        <AudioEngine
          ref={engineRef}
          src={song.url}
          playing={isPlaying}
          volume={level}
          rate={rate}
          {...engineEvents}
        />
      )}

      {/* Small screens: thin progress line instead of the seek bar */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-[4px] bg-white/15 md:hidden"
      >
        <div className="h-full bg-white" style={{ width: `${progress}%` }} />
      </div>

      {/* What's playing */}
      <div className="flex min-w-0 items-center gap-3">
        <CoverImage src={thumbnail} alt="" className="w-11 md:w-12" />
        <div className="min-w-0 text-xs">
          <h2 className="truncate text-sm" title={song.title}>
            {song.title}
          </h2>
          {artistLine}
          {failed && (
            <p role="alert" className="truncate text-red-300" title={failure}>
              {failure}
            </p>
          )}
        </div>
        <LikeButton song={song} className="hidden shrink-0 sm:inline-flex" />
      </div>

      {/* Transport */}
      <div className="flex min-w-0 flex-col items-center gap-1">
        <div className="flex items-center justify-center gap-1 md:gap-2">
          <button
            className={cn(
              iconButton,
              "hidden md:inline-flex",
              shuffle && "text-amber-400 hover:text-amber-300",
            )}
            onClick={() => dispatch(toggleShuffle())}
            aria-pressed={shuffle}
            aria-label="Shuffle"
            title={shuffle ? "Shuffle: on" : "Shuffle: off"}
          >
            <Shuffle size={16} />
          </button>
          <button
            className={cn(iconButton, "hidden sm:inline-flex")}
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
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 disabled:opacity-50"
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
              "hidden md:inline-flex",
              repeat !== "off" && "text-amber-400 hover:text-amber-300",
            )}
            onClick={() => dispatch(cycleRepeat())}
            aria-label={repeatLabel}
            title={repeatLabel}
          >
            <RepeatIcon size={16} />
          </button>
        </div>
        <div className="hidden w-full items-center gap-2 text-[0.7rem] text-gray-300 tabular-nums md:flex">
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
      </div>

      {/* Volume and view */}
      <div className="flex min-w-0 items-center justify-end gap-1">
        <button
          className={cn(iconButton, "hidden md:inline-flex")}
          onClick={toggleMute}
          aria-label={level > 0 ? "Mute" : "Unmute"}
          title={level > 0 ? "Mute (M)" : "Unmute (M)"}
        >
          <VolumeIcon size={16} />
        </button>
        <Slider
          aria-label="Volume"
          className="hidden w-24 lg:flex"
          value={[level]}
          max={1}
          step={0.05}
          onValueChange={([value]) => {
            setVolume(value);
            setMuted(false);
          }}
        />
        <PlayerOptions
          className="hidden sm:block"
          rate={rate}
          onRate={setRate}
          sleep={sleep}
          onSleep={setSleep}
        />
        <button
          className={iconButton}
          onClick={page ? closePage : openPage}
          aria-label={page ? "Close Now Playing" : "Open Now Playing"}
          title={page ? "Close Now Playing (Esc)" : "Open Now Playing"}
        >
          {page ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
        </button>
        <button
          className={cn(iconButton, "hidden sm:inline-flex")}
          onClick={() => dispatch(removeSong())}
          aria-label="Close player"
          title="Close player"
        >
          <X size={16} />
        </button>
      </div>
    </aside>
  );
};

export default Player;
