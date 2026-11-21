import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { YT_STATE, youtubeErrorMessage, type YTPlayer } from "@/lib/youtube";
import { attachYouTubePlayer, getYouTubePlayer, setYouTubeHandlers } from "@/lib/youtubePlayer";
import { cn } from "@/lib/utils";

export interface EngineHandle {
  seek: (seconds: number) => void;
  /** Play the track again from the beginning (used for repeat) */
  restart: () => void;
}

export interface EngineEvents {
  onTime?: (seconds: number) => void;
  onDuration?: (seconds: number) => void;
  onEnded?: () => void;
  onError?: (message: string) => void;
  /** The engine started/stopped on its own (e.g. the viewer used YouTube's own controls) */
  onPlayingChange?: (playing: boolean) => void;
  /** YouTube only: the video's title, once known */
  onTitle?: (title: string) => void;
}

interface Props extends EngineEvents {
  videoId: string;
  playing: boolean;
  /** 0..1 */
  volume?: number;
  /** Playback speed, 1 = normal */
  rate?: number;
  ref?: Ref<EngineHandle>;
  className?: string;
}

/**
 * Embedded YouTube player driven by props. The video stays visible, as
 * YouTube's terms require for embedded playback: the shared player is laid
 * over this component's box.
 */
const YouTubeEngine = ({
  videoId,
  playing,
  volume = 1,
  rate = 1,
  ref,
  className,
  ...events
}: Props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<YTPlayer | null>(null);
  // Latest callbacks / props, readable from the long-lived player listeners
  const latest = useRef({ events, playing, videoId });
  useEffect(() => {
    latest.current = { events, playing, videoId };
  });
  /** The video the player has (or is getting); switched with loadVideoById */
  const loadedId = useRef<string | null>(null);
  /** When we last started a video, to tell the browser's pauses from the user's */
  const startedAt = useRef(0);
  /** Chrome held playback while the tab was hidden: start when it's visible */
  const resumeWhenVisible = useRef(false);

  // The session's single player (lib/youtubePlayer): it was created while
  // the tab was visible, so it can switch videos and keep playing in a
  // background tab, where a new iframe often wouldn't start until the tab is
  // visible again. It's shown over this component's box.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let timer: number | undefined;
    const detach = attachYouTubePlayer(host);

    const onVisible = () => {
      if (document.hidden || !player) return;
      const state = player.getPlayerState();
      const stalled = state !== YT_STATE.PLAYING && state !== YT_STATE.BUFFERING && state !== YT_STATE.ENDED;
      if (latest.current.playing && (resumeWhenVisible.current || stalled)) player.playVideo();
      resumeWhenVisible.current = false;
    };
    let player: YTPlayer | null = null;
    document.addEventListener("visibilitychange", onVisible);

    setYouTubeHandlers({
      onStateChange: (data, target) => {
        const { onPlayingChange, onEnded } = latest.current.events;
        if (data === YT_STATE.PLAYING) {
          resumeWhenVisible.current = false;
          onPlayingChange?.(true);
        } else if (data === YT_STATE.PAUSED) {
          const sinceStart = Date.now() - startedAt.current;
          const videoNow = target.getVideoData()?.video_id;
          // Switching videos pauses the old one first: not the listener
          const oldVideo = videoNow !== undefined && videoNow !== loadedId.current;
          if (latest.current.playing && (oldVideo || sinceStart < 1500)) return;
          // Paused in a hidden tab right after we started it: that's the
          // browser holding playback, not the listener. Keep "playing"
          // and start as soon as the tab is visible.
          const justStarted = sinceStart < 8000;
          if (document.hidden && latest.current.playing && justStarted) {
            resumeWhenVisible.current = true;
          } else {
            onPlayingChange?.(false);
          }
        } else if (data === YT_STATE.ENDED) onEnded?.();
      },
      onError: (code) => latest.current.events.onError?.(youtubeErrorMessage(code)),
    });

    getYouTubePlayer()
      .then((target) => {
        if (cancelled) return;
        player = target;
        // Same video as before this remount (e.g. moved to the Now Playing
        // page): carry on from where it is instead of starting over
        if (target.getVideoData()?.video_id === latest.current.videoId) {
          loadedId.current = latest.current.videoId;
        }
        setPlayer(target);
        const report = () => {
          const { onTime, onDuration, onTitle } = latest.current.events;
          const data = target.getVideoData();
          // Still showing the previous video: nothing to report yet
          if (data?.video_id && data.video_id !== loadedId.current) return;
          const duration = target.getDuration();
          if (duration > 0) onDuration?.(duration);
          onTime?.(target.getCurrentTime() || 0);
          if (data?.title) onTitle?.(data.title);
        };
        timer = window.setInterval(report, 500);
      })
      .catch(() => {
        if (cancelled) return;
        latest.current.events.onError?.(
          "Couldn't load the YouTube player. Check your connection.",
        );
      });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      setYouTubeHandlers({});
      detach();
      // The player stays for the next YouTube song; just stop this one
      try {
        player?.pauseVideo();
      } catch {
        // not ready
      }
      setPlayer(null);
    };
  }, []);

  // A new song (or the first one): switch the video inside the player
  useEffect(() => {
    if (!player || loadedId.current === videoId) return;
    loadedId.current = videoId;
    startedAt.current = Date.now();
    resumeWhenVisible.current = false;
    if (!latest.current.playing) {
      player.cueVideoById(videoId);
      return;
    }
    player.loadVideoById(videoId);
    // In a hidden tab the start can be held back once; nudge it
    const retry = window.setTimeout(() => {
      const state = player.getPlayerState();
      if (latest.current.playing && (state === YT_STATE.UNSTARTED || state === YT_STATE.CUED)) {
        player.playVideo();
      }
    }, 3000);
    return () => window.clearTimeout(retry);
  }, [player, videoId]);

  useEffect(() => {
    if (!player) return;
    if (playing) player.playVideo();
    else player.pauseVideo();
  }, [player, playing]);

  useEffect(() => {
    player?.setVolume(Math.round(volume * 100));
  }, [player, volume]);

  useEffect(() => {
    player?.setPlaybackRate(rate);
  }, [player, rate]);

  useImperativeHandle(
    ref,
    () => ({
      seek: (seconds) => player?.seekTo(seconds, true),
      restart: () => {
        player?.seekTo(0, true);
        player?.playVideo();
      },
    }),
    [player],
  );

  return (
    <div
      ref={hostRef}
      className={cn("overflow-hidden rounded-[4px] bg-black", className)}
    />
  );
};

export default YouTubeEngine;
