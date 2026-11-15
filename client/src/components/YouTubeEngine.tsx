import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import {
  YT_STATE,
  loadYouTubeApi,
  youtubeErrorMessage,
  type YTPlayer,
} from "@/lib/youtube";
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
  ref?: Ref<EngineHandle>;
  className?: string;
}

/**
 * Embedded YouTube player driven by props. The video stays visible, as
 * YouTube's terms require for embedded playback.
 */
const YouTubeEngine = ({
  videoId,
  playing,
  volume = 1,
  ref,
  className,
  ...events
}: Props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<YTPlayer | null>(null);
  // Latest callbacks / props, readable from the long-lived player listeners
  const latest = useRef({ events, playing });
  useEffect(() => {
    latest.current = { events, playing };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let created: YTPlayer | null = null;
    let timer: number | undefined;
    // YT.Player replaces the element it is given with an <iframe>, so hand it
    // a node React doesn't manage.
    const mount = document.createElement("div");
    host.appendChild(mount);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        created = new YT.Player(mount, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            autoplay: latest.current.playing ? 1 : 0,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: ({ target }) => {
              if (cancelled) return;
              setPlayer(target);
              const report = () => {
                const { onTime, onDuration, onTitle } = latest.current.events;
                const duration = target.getDuration();
                if (duration > 0) onDuration?.(duration);
                onTime?.(target.getCurrentTime() || 0);
                const title = target.getVideoData()?.title;
                if (title) onTitle?.(title);
              };
              report();
              timer = window.setInterval(report, 500);
            },
            onStateChange: ({ data }) => {
              const { onPlayingChange, onEnded } = latest.current.events;
              if (data === YT_STATE.PLAYING) onPlayingChange?.(true);
              else if (data === YT_STATE.PAUSED) onPlayingChange?.(false);
              else if (data === YT_STATE.ENDED) onEnded?.();
            },
            onError: ({ data }) => {
              latest.current.events.onError?.(youtubeErrorMessage(data));
            },
          },
        });
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
      try {
        created?.destroy();
      } catch {
        // already gone
      }
      host.replaceChildren();
      setPlayer(null);
    };
  }, [videoId]);

  useEffect(() => {
    if (!player) return;
    if (playing) player.playVideo();
    else player.pauseVideo();
  }, [player, playing]);

  useEffect(() => {
    player?.setVolume(Math.round(volume * 100));
  }, [player, volume]);

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
