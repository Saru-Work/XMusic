import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { SongType } from "../types/song";

const initialState: { song: SongType | null } = {
  song: null,
};
const songSlice = createSlice({
  name: "song",
  initialState,
  reducers: {
    storeSong(state, action: PayloadAction<SongType>) {
      console.log(action.payload);
      state.song = action.payload;
    },
    removeSong(state) {
      state.song = null;
    },
  },
});

export const { storeSong, removeSong } = songSlice.actions;
export default songSlice.reducer;
