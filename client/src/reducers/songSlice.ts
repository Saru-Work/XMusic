import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { SongType } from "../types/song";

export type RepeatMode = "off" | "all" | "one";

export interface PlayerState {
  /** Songs in the order they will play (shuffled when shuffle is on) */
  queue: SongType[];
  /** The list playback was started from, in its original order */
  source: SongType[];
  index: number;
  song: SongType | null;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Recently played songs, newest first */
  history: SongType[];
}

const HISTORY_KEY = "xmusic:history";
const SESSION_KEY = "xmusic:session";
const HISTORY_LIMIT = 50;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full: this just won't persist
  }
}

const isSong = (value: unknown): value is SongType =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as SongType)._id === "string" &&
  typeof (value as SongType).title === "string" &&
  typeof (value as SongType).url === "string";

function storedHistory(): SongType[] {
  const saved = readJson<unknown>(HISTORY_KEY);
  return Array.isArray(saved) ? saved.filter(isSong).slice(0, HISTORY_LIMIT) : [];
}

/** The queue from the last visit, so a reload doesn't lose your place */
function storedSession(): Pick<PlayerState, "queue" | "source" | "index" | "song"> {
  const empty = { queue: [], source: [], index: -1, song: null };
  const saved = readJson<{ queue?: unknown; source?: unknown; index?: unknown }>(
    SESSION_KEY,
  );
  if (!saved || !Array.isArray(saved.queue)) return empty;
  const queue = saved.queue.filter(isSong);
  const index = Number(saved.index);
  if (queue.length !== saved.queue.length || !queue[index]) return empty;
  const source = Array.isArray(saved.source) ? saved.source.filter(isSong) : [];
  return {
    queue,
    source: source.length ? source : queue,
    index,
    song: queue[index],
  };
}

/** Called by the store whenever the player state changes */
export function savePlayerSession(state: PlayerState) {
  writeJson(SESSION_KEY, {
    queue: state.queue,
    source: state.source,
    index: state.index,
  });
  writeJson(HISTORY_KEY, state.history);
}

const PREFS_KEY = "xmusic:player";

function storedPrefs(): Pick<PlayerState, "shuffle" | "repeat"> {
  try {
    const prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    return {
      shuffle: prefs.shuffle === true,
      repeat: ["off", "all", "one"].includes(prefs.repeat) ? prefs.repeat : "off",
    };
  } catch {
    return { shuffle: false, repeat: "off" };
  }
}

export function savePlayerPrefs(state: Pick<PlayerState, "shuffle" | "repeat">) {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ shuffle: state.shuffle, repeat: state.repeat }),
    );
  } catch {
    // Storage unavailable (private mode): the preference just won't persist
  }
}

const initialState: PlayerState = {
  // Restored paused: browsers block autoplay on page load anyway
  ...storedSession(),
  isPlaying: false,
  ...storedPrefs(),
  history: storedHistory(),
};

function select(state: PlayerState, index: number) {
  state.index = index;
  const song = state.queue[index] ?? null;
  state.song = song;
  state.isPlaying = song !== null;
  if (song) {
    state.history = [
      song,
      ...state.history.filter((s) => s._id !== song._id),
    ].slice(0, HISTORY_LIMIT);
  }
}

/** Small seeded PRNG so reducers stay pure: the seed travels in the action */
function seededRandom(seed: number) {
  let a = Math.floor(seed * 2 ** 32) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `first` stays at the front; the rest follow in random order */
function shuffled(songs: SongType[], first: number, seed: number) {
  const random = seededRandom(seed);
  const rest = songs.filter((_, i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [songs[first], ...rest];
}

const songSlice = createSlice({
  name: "song",
  initialState,
  reducers: {
    playQueue: {
      reducer(
        state,
        action: PayloadAction<{ songs: SongType[]; index: number; seed: number }>,
      ) {
        const { songs, index, seed } = action.payload;
        state.source = songs;
        if (state.shuffle && songs.length > 1) {
          state.queue = shuffled(songs, index, seed);
          select(state, 0);
        } else {
          state.queue = songs;
          select(state, index);
        }
      },
      prepare(payload: { songs: SongType[]; index?: number }) {
        return {
          payload: {
            songs: payload.songs,
            index: payload.index ?? 0,
            seed: Math.random(),
          },
        };
      },
    },
    /** Next song; wraps to the start when repeat is "all" */
    nextSong(state) {
      if (state.index < state.queue.length - 1) select(state, state.index + 1);
      else if (state.repeat === "all" && state.queue.length > 1) select(state, 0);
    },
    prevSong(state) {
      if (state.index > 0) select(state, state.index - 1);
      else if (state.repeat === "all" && state.queue.length > 1)
        select(state, state.queue.length - 1);
    },
    /** Jump to a song in the queue */
    jumpTo(state, action: PayloadAction<number>) {
      if (state.queue[action.payload]) select(state, action.payload);
    },
    setPlaying(state, action: PayloadAction<boolean>) {
      state.isPlaying = action.payload && state.song !== null;
    },
    toggleShuffle: {
      reducer(state, action: PayloadAction<number>) {
        state.shuffle = !state.shuffle;
        const current = state.song;
        if (!current) return;
        const position = state.source.findIndex((s) => s._id === current._id);
        if (state.shuffle) {
          // Keep playing the current song; shuffle what comes after it
          state.queue = shuffled(state.source, Math.max(position, 0), action.payload);
          state.index = 0;
        } else {
          state.queue = state.source;
          state.index = Math.max(position, 0);
        }
      },
      prepare() {
        return { payload: Math.random() };
      },
    },
    cycleRepeat(state) {
      state.repeat =
        state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
    },
    /** Put a song right after the current one */
    playNext(state, action: PayloadAction<SongType>) {
      const song = action.payload;
      if (!state.song) {
        state.queue = [song];
        state.source = [song];
        select(state, 0);
        return;
      }
      if (state.song._id === song._id) return;
      const currentId = state.song._id;
      state.queue = state.queue.filter((s) => s._id !== song._id);
      state.index = state.queue.findIndex((s) => s._id === currentId);
      state.queue.splice(state.index + 1, 0, song);
      if (!state.source.some((s) => s._id === song._id)) state.source.push(song);
    },
    /** Add a song to the end of the queue (starts playing if nothing is) */
    addToQueue(state, action: PayloadAction<SongType>) {
      const song = action.payload;
      if (!state.song) {
        state.queue = [song];
        state.source = [song];
        select(state, 0);
        return;
      }
      if (state.queue.some((s) => s._id === song._id)) return;
      state.queue.push(song);
      if (!state.source.some((s) => s._id === song._id)) state.source.push(song);
    },
    /** Remove an upcoming or earlier song (not the one that is playing) */
    removeFromQueue(state, action: PayloadAction<number>) {
      const position = action.payload;
      const removed = state.queue[position];
      if (!removed || position === state.index) return;
      state.queue.splice(position, 1);
      state.source = state.source.filter((s) => s._id !== removed._id);
      if (position < state.index) state.index -= 1;
    },
    /** Drop everything after the current song */
    clearUpcoming(state) {
      const upcoming = new Set(
        state.queue.slice(state.index + 1).map((s) => s._id),
      );
      state.queue = state.queue.slice(0, state.index + 1);
      state.source = state.source.filter((s) => !upcoming.has(s._id));
    },
    clearHistory(state) {
      state.history = [];
    },
    removeSong(state) {
      state.queue = [];
      state.source = [];
      select(state, -1);
    },
  },
});

export const {
  playQueue,
  nextSong,
  prevSong,
  jumpTo,
  setPlaying,
  toggleShuffle,
  cycleRepeat,
  playNext,
  addToQueue,
  removeFromQueue,
  clearUpcoming,
  clearHistory,
  removeSong,
} = songSlice.actions;
export default songSlice.reducer;
