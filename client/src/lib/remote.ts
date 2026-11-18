import { io, type Socket } from "socket.io-client";
import { store } from "../store/store";
import {
  addToQueue,
  cycleRepeat,
  nextSong,
  playNext,
  playQueue,
  prevSong,
  setPlaying,
  toggleShuffle,
  type PlayerState,
  type RepeatMode,
} from "../reducers/songSlice";
import { showToast } from "../reducers/toastSlice";
import { removeUser } from "../reducers/userReducer";
import type { SongType } from "../types/song";
import { api, API_URL, ApiError } from "./api";

/**
 * Remote control: the server (and later ChatGPT, through the MCP server) can
 * tell this tab what to play. Commands become the same Redux actions a click
 * would dispatch, so the player behaves exactly as if you'd done it yourself.
 */

type PlayCommand = {
  type: "play";
  from: string;
  songs: SongType[];
  mode: "replace" | "next" | "append";
  shuffle?: boolean;
};
type ControlCommand = {
  type: "control";
  from: string;
  action: "pause" | "resume" | "toggle" | "next" | "previous" | "shuffle" | "repeat";
  value?: boolean | RepeatMode;
};
type Command = PlayCommand | ControlCommand;

type Answer = {
  ok: boolean;
  /** Why it didn't (fully) work, for the caller to explain */
  reason?: "autoplay_blocked" | "nothing_loaded" | "end_of_queue" | "playback_failed" | "error";
  message?: string;
  nowPlaying: NowPlaying;
};

export interface NowPlaying {
  song: { id: string; title: string; artist: string | null; source: string; duration: number } | null;
  isPlaying: boolean;
  /** 1-based position in the queue */
  position: number;
  queueLength: number;
  upNext: string[];
  shuffle: boolean;
  repeat: RepeatMode;
}

/** How long to wait after starting playback before checking it really started */
const START_CHECK_MS = 1500;

const player = () => store.getState().song;

function artistName(song: SongType) {
  if (song.artist && typeof song.artist === "object") return song.artist.title;
  return song.channel ?? null;
}

export function nowPlaying(state: PlayerState = player()): NowPlaying {
  const { song, queue, index } = state;
  return {
    song: song && {
      id: song._id,
      title: song.title,
      artist: artistName(song),
      source: song.source ?? "upload",
      duration: song.duration,
    },
    isPlaying: state.isPlaying,
    position: song ? index + 1 : 0,
    queueLength: queue.length,
    upNext: queue.slice(index + 1, index + 6).map((s) => s.title),
    shuffle: state.shuffle,
    repeat: state.repeat,
  };
}

/** Browsers only let a page play audio after you've clicked or typed in it */
function canAutoplay() {
  return navigator.userActivation?.hasBeenActive ?? true;
}

function deviceLabel() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Mac OS X/.test(ua)
    ? "Mac"
    : /Windows/.test(ua)
      ? "Windows"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let playOnInteraction = false;
let interactionListening = false;

/**
 * Autoplay was blocked: start playing on the next click or key press
 * anywhere in the tab (that interaction is what unlocks audio).
 */
export function startOnFirstInteraction() {
  playOnInteraction = true;
  if (interactionListening) return;
  interactionListening = true;
  const onInteraction = () => {
    window.removeEventListener("click", onInteraction, true);
    window.removeEventListener("keydown", onInteraction, true);
    interactionListening = false;
    // Let the click reach its own handlers first: if it was the play button,
    // the player is already playing and there's nothing to do
    setTimeout(() => {
      const state = player();
      if (playOnInteraction && state.song && !state.isPlaying) store.dispatch(setPlaying(true));
      playOnInteraction = false;
    }, 0);
  };
  window.addEventListener("click", onInteraction, true);
  window.addEventListener("keydown", onInteraction, true);
}

/** Once the player was asked to play, check it actually is playing */
async function confirmPlaying(): Promise<Answer> {
  if (!canAutoplay()) {
    // play() would be rejected; load the songs paused and start on one click
    store.dispatch(setPlaying(false));
    startOnFirstInteraction();
    store.dispatch(showToast("Click anywhere to start playing"));
    return {
      ok: false,
      reason: "autoplay_blocked",
      message: "The songs are loaded. Click anywhere in the XMusic tab once and they'll start playing.",
      nowPlaying: nowPlaying(),
    };
  }
  playOnInteraction = false;
  await wait(START_CHECK_MS);
  const state = player();
  if (state.isPlaying) return { ok: true, nowPlaying: nowPlaying(state) };
  return {
    ok: false,
    reason: "playback_failed",
    message: "The player couldn't start this song.",
    nowPlaying: nowPlaying(state),
  };
}

function setShuffle(on: boolean) {
  if (player().shuffle !== on) store.dispatch(toggleShuffle());
}

function setRepeat(mode: RepeatMode) {
  for (let i = 0; i < 3 && player().repeat !== mode; i++) store.dispatch(cycleRepeat());
}

async function runPlay(command: PlayCommand): Promise<Answer> {
  const { songs, mode, shuffle } = command;
  // Nothing playing yet: adding to the queue is the same as starting fresh
  const replace = mode === "replace" || !player().song;

  if (replace) {
    // Set shuffle first so playQueue shuffles the new list
    if (shuffle !== undefined) setShuffle(shuffle);
    store.dispatch(playQueue({ songs, index: 0 }));
    store.dispatch(
      showToast(`${command.from}: playing "${songs[0].title}"${songs.length > 1 ? ` + ${songs.length - 1} more` : ""}`),
    );
    return confirmPlaying();
  }

  if (mode === "next") {
    // Each playNext goes right after the current song, so insert in reverse
    for (const song of [...songs].reverse()) store.dispatch(playNext(song));
  } else {
    for (const song of songs) store.dispatch(addToQueue(song));
  }
  store.dispatch(
    showToast(
      `${command.from}: ${songs.length === 1 ? `"${songs[0].title}"` : `${songs.length} songs`} added ${mode === "next" ? "to play next" : "to the queue"}`,
    ),
  );
  return { ok: true, nowPlaying: nowPlaying() };
}

async function runControl(command: ControlCommand): Promise<Answer> {
  const before = player();
  const done = (): Answer => ({ ok: true, nowPlaying: nowPlaying() });
  const nothing = (): Answer => ({
    ok: false,
    reason: "nothing_loaded",
    message: "Nothing is loaded in the player.",
    nowPlaying: nowPlaying(),
  });

  switch (command.action) {
    case "pause":
      playOnInteraction = false; // Don't start on the next click after all
      store.dispatch(setPlaying(false));
      return done();
    case "resume":
      if (!before.song) return nothing();
      store.dispatch(setPlaying(true));
      return confirmPlaying();
    case "toggle":
      if (!before.song) return nothing();
      store.dispatch(setPlaying(!before.isPlaying));
      return before.isPlaying ? done() : confirmPlaying();
    case "next":
    case "previous": {
      if (!before.song) return nothing();
      store.dispatch(command.action === "next" ? nextSong() : prevSong());
      if (player().index === before.index && before.queue.length > 1) {
        return {
          ok: false,
          reason: "end_of_queue",
          message: command.action === "next" ? "This is the last song in the queue." : "This is the first song in the queue.",
          nowPlaying: nowPlaying(),
        };
      }
      return player().isPlaying ? confirmPlaying() : done();
    }
    case "shuffle":
      setShuffle(command.value === true);
      return done();
    case "repeat":
      setRepeat(command.value as RepeatMode);
      return done();
  }
}

async function run(command: Command): Promise<Answer> {
  try {
    return command.type === "play" ? await runPlay(command) : await runControl(command);
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Something went wrong in the player.",
      nowPlaying: nowPlaying(),
    };
  }
}

/**
 * Connects this tab to the server's remote control. Call when a listener
 * logs in; the returned function disconnects (on logout / unmount).
 */
export function startRemote(): () => void {
  const socket: Socket = io(API_URL, { withCredentials: true });
  // You may have clicked (e.g. the login button) before this started; that
  // counts, otherwise an untouched tab could win over the one you're using
  let lastInteraction = navigator.userActivation?.hasBeenActive ? Date.now() : 0;

  const report = (extra: Record<string, unknown> = {}) =>
    socket.connected && socket.emit("device:state", { canAutoplay: canAutoplay(), ...extra });

  socket.on("connect", () => {
    report({ label: deviceLabel(), lastInteraction, nowPlaying: nowPlaying() });
  });

  socket.on("command", (command: Command, ack: (answer: Answer) => void) => {
    run(command).then(ack);
  });

  // The server refuses the socket when the login cookie is missing or has
  // expired, and Socket.IO then stops retrying. Check whether the login is
  // really gone: if so, log out here so it shows (and remote control isn't
  // silently dead); otherwise it was a hiccup, so try again.
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  socket.on("connect_error", (err) => {
    if (socket.active) return; // Network trouble: Socket.IO keeps retrying itself
    if (err.message !== "Unauthorized") return;
    api("/profile")
      .then(() => {
        retryTimer = setTimeout(() => socket.connect(), 5000);
      })
      .catch((apiErr) => {
        if (apiErr instanceof ApiError && apiErr.status === 401) {
          // Logging out unmounts this remote (AppLayout), which disconnects it
          store.dispatch(removeUser());
          store.dispatch(showToast("Your login expired. Log in again to keep using XMusic.", "error"));
        } else {
          retryTimer = setTimeout(() => socket.connect(), 5000);
        }
      });
  });

  // The tab you touched last is the one remote commands go to. Report at
  // most every few seconds; the first interaction is sent straight away
  // because it's also what unlocks autoplay.
  let interactionTimer: ReturnType<typeof setTimeout> | null = null;
  const onInteraction = () => {
    const first = lastInteraction === 0;
    lastInteraction = Date.now();
    if (first) return report({ lastInteraction });
    interactionTimer ??= setTimeout(() => {
      interactionTimer = null;
      report({ lastInteraction });
    }, 3000);
  };
  window.addEventListener("pointerdown", onInteraction, true);
  window.addEventListener("keydown", onInteraction, true);

  // Keep the server's "now playing" for this tab current
  let saved = player();
  let stateTimer: ReturnType<typeof setTimeout> | null = null;
  const unsubscribe = store.subscribe(() => {
    const state = player();
    if (
      state.song === saved.song &&
      state.isPlaying === saved.isPlaying &&
      state.queue === saved.queue &&
      state.index === saved.index &&
      state.shuffle === saved.shuffle &&
      state.repeat === saved.repeat
    ) {
      return;
    }
    saved = state;
    if (stateTimer) clearTimeout(stateTimer);
    stateTimer = setTimeout(() => {
      stateTimer = null;
      report({ nowPlaying: nowPlaying() });
    }, 300);
  });

  return () => {
    unsubscribe();
    window.removeEventListener("pointerdown", onInteraction, true);
    window.removeEventListener("keydown", onInteraction, true);
    if (interactionTimer) clearTimeout(interactionTimer);
    if (stateTimer) clearTimeout(stateTimer);
    if (retryTimer) clearTimeout(retryTimer);
    socket.disconnect();
  };
}
