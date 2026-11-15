import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { SongType } from "../types/song";

interface PlayerState {
  /** Songs lined up for playback (the list the current song was started from) */
  queue: SongType[];
  index: number;
  song: SongType | null;
  isPlaying: boolean;
}

const initialState: PlayerState = {
  queue: [],
  index: -1,
  song: null,
  isPlaying: false,
};

function select(state: PlayerState, index: number) {
  state.index = index;
  state.song = state.queue[index] ?? null;
  state.isPlaying = state.song !== null;
}

const songSlice = createSlice({
  name: "song",
  initialState,
  reducers: {
    playQueue(
      state,
      action: PayloadAction<{ songs: SongType[]; index?: number }>,
    ) {
      state.queue = action.payload.songs;
      select(state, action.payload.index ?? 0);
    },
    nextSong(state) {
      if (state.index < state.queue.length - 1) select(state, state.index + 1);
    },
    prevSong(state) {
      if (state.index > 0) select(state, state.index - 1);
    },
    setPlaying(state, action: PayloadAction<boolean>) {
      state.isPlaying = action.payload && state.song !== null;
    },
    removeSong(state) {
      state.queue = [];
      select(state, -1);
    },
  },
});

export const { playQueue, nextSong, prevSong, setPlaying, removeSong } =
  songSlice.actions;
export default songSlice.reducer;
