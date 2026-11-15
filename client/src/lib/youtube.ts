import type { SongType } from "../types/song";

// Minimal typings + loader for the YouTube IFrame Player API
// https://developers.google.com/youtube/iframe_api_reference

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): { title?: string; author?: string };
  destroy(): void;
}

interface YTPlayerOptions {
  width?: string;
  height?: string;
  videoId: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (event: { target: YTPlayer }) => void;
    onStateChange?: (event: { data: number; target: YTPlayer }) => void;
    onError?: (event: { data: number }) => void;
  };
}

interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 } as const;

let apiPromise: Promise<YTNamespace> | null = null;

/** Loads the IFrame API script once and resolves with the global `YT` object */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null; // allow a retry later
      script.remove();
      reject(new Error("YouTube API failed to load"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Player error codes -> something a listener can act on */
export function youtubeErrorMessage(code: number) {
  if (code === 100) return "This YouTube video is no longer available.";
  if (code === 101 || code === 150) {
    return "The owner of this video doesn't allow it to be played here.";
  }
  return "This YouTube video couldn't be played.";
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/**
 * Accepts a YouTube / YouTube Music link (watch, youtu.be, shorts, embed, live)
 * or a bare video id. Mirrors server/youtube.js.
 */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (VIDEO_ID.test(value)) return value;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  let id: string | null | undefined = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1];
  } else if (HOSTS.has(host)) {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(first)) id = second;
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

/** A video as returned by the server's /youtube endpoints */
export interface YouTubeResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: number;
}

const RESULT_PREFIX = "yt:";

/** A playable song for a YouTube result that isn't stored in the library */
export function youtubeResultToSong(result: YouTubeResult): SongType {
  return {
    _id: `${RESULT_PREFIX}${result.videoId}`,
    title: result.title,
    url: `https://www.youtube.com/watch?v=${result.videoId}`,
    duration: result.duration,
    artist: null,
    source: "youtube",
    youtubeId: result.videoId,
    channel: result.channel,
  };
}

/** True for songs created by `youtubeResultToSong` (they have no database id) */
export function isYouTubeResult(song: SongType) {
  return song._id.startsWith(RESULT_PREFIX);
}
