import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { SongType } from "../types/song";
import { removeUser } from "./userReducer";

/** The logged-in listener's liked songs, newest first */
const likesSlice = createSlice({
  name: "likes",
  initialState: { songs: [] as SongType[] },
  reducers: {
    setLikes(state, action: PayloadAction<SongType[]>) {
      state.songs = action.payload;
    },
    addLike(state, action: PayloadAction<SongType>) {
      const song = action.payload;
      state.songs = [song, ...state.songs.filter((s) => s._id !== song._id)];
    },
    removeLike(state, action: PayloadAction<string>) {
      state.songs = state.songs.filter((s) => s._id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    // Logging out forgets them
    builder.addCase(removeUser, (state) => {
      state.songs = [];
    });
  },
});

export const { setLikes, addLike, removeLike } = likesSlice.actions;
export default likesSlice.reducer;
