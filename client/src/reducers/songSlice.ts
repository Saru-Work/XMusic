import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { SongType } from "../types/song";

export type RepeatMode = "off" | "all" | "one";

interface PlayerState {
  /** Songs in the order they will play (shuffled when shuffle is on) */
  queue: SongType[];
  /** The list playback was started from, in its original order */
  source: SongType[];
  index: number;
  song: SongType | null;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
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
  queue: [],
  source: [],
  index: -1,
  song: null,
  isPlaying: false,
  ...storedPrefs(),
};

function select(state: PlayerState, index: number) {
  state.index = index;
  state.song = state.queue[index] ?? null;
  state.isPlaying = state.song !== null;
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
  removeSong,
} = songSlice.actions;
export default songSlice.reducer;
