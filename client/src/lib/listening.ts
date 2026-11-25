import type { SongType } from "../types/song";
import { store } from "../store/store";
import { api, LIBRARY_CHANGED, type LibraryChange } from "./api";
import { isYouTubeResult } from "./youtube";

// Measures how long songs are really listened to and saves it to the
// logged-in listener's history.

/** A play is saved once it has been heard this long */
const REPORT_AFTER = 5;
/** Leaving a song before this many seconds (and before half of it) is a skip */
const SKIP_BEFORE = 30;

interface Listen {
  id: string;
  userId: string;
  song: SongType;
  duration: number;
  seconds: number;
  /** Seconds in the last report; null before the first one */
  reported: number | null;
}

let listen: Listen | null = null;
/** Song position and clock at the last tick; null when the next tick can't be compared */
let last: { position: number; at: number } | null = null;

function send(current: Listen, outcome: { completed?: boolean; skipped?: boolean } = {}) {
  // Someone else logged in (or nobody is) since this was played
  if (store.getState().user.user?._id !== current.userId) return;
  const first = current.reported === null;
  const { song } = current;
  current.reported = current.seconds;
  api(`/history/plays/${current.id}`, {
    method: "PUT",
    // Lets the last report finish while the page is closing
    keepalive: true,
    json: {
      ...(isYouTubeResult(song)
        ? {
            videoId: song.youtubeId,
            title: song.title,
            channel: song.channel,
            duration: current.duration,
          }
        : { songId: song._id }),
      seconds: Math.round(current.seconds),
      ...outcome,
    },
  })
    .then(() => {
      if (!first) return;
      const detail: LibraryChange = { kind: "history" };
      window.dispatchEvent(new CustomEvent(LIBRARY_CHANGED, { detail }));
    })
    .catch(() => {
      // History is best effort: it must never get in the way of playing
    });
}

function newId() {
  // randomUUID is missing on plain-http pages other than localhost
  return (
    crypto.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2).padEnd(8, "0")}`
  );
}

/** The player's position moved on (called a few times a second) */
export function trackProgress(song: SongType, position: number, duration: number, rate: number) {
  const now = performance.now();
  const previous = last;
  last = { position, at: now };
  const userId = store.getState().user.user?._id;
  if (listen && (listen.userId !== userId || listen.song._id !== song._id)) listen = null;
  if (!previous || !userId) return;
  // Real listening can't move the song faster than the clock, so jumps from
  // seeking add almost nothing
  const heard = Math.min((position - previous.position) / rate, (now - previous.at) / 1000);
  if (heard <= 0) return;
  listen ??= { id: newId(), userId, song, duration, seconds: 0, reported: null };
  listen.seconds += heard;
  listen.duration = duration;
  if (listen.reported === null && listen.seconds >= REPORT_AFTER) send(listen);
}

/** The position is about to jump, or playback paused or resumed */
export function trackJump() {
  last = null;
}

/** The song played to its end, or the listener left it */
export function trackEnd(reason: "completed" | "left") {
  const ended = listen;
  listen = null;
  last = null;
  if (!ended || ended.seconds < 1) return;
  if (reason === "completed") return send(ended, { completed: true });
  const { seconds, duration } = ended;
  const skipped = seconds < SKIP_BEFORE && (!duration || seconds < duration / 2);
  send(ended, { skipped });
}

/** Forget the current listen, so a cleared history stays clear */
export function discardListen() {
  listen = null;
  last = null;
}

// The page may be closed at any time once it's hidden: save what we have
function flush() {
  if (listen?.reported != null && listen.seconds - listen.reported >= 1) send(listen);
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flush();
});
window.addEventListener("pagehide", flush);
