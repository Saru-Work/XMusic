import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
interface userState {
  _id?: string;
  name?: string;
  email?: string;
  photoUrl?: string;
  isArtist?: boolean;
}
interface AuthState {
  user: userState | null;
  initialized: boolean;
}
const initialState: AuthState = { user: null, initialized: false };
const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    storeUser(state, action: PayloadAction<userState>) {
      state.user = action.payload;
      state.initialized = true;
    },
    removeUser(state) {
      state.user = null;
      state.initialized = true;
    },
    setInitialized(state) {
      state.initialized = true;
    },
  },
});

export const { storeUser, removeUser } = userSlice.actions;
export default userSlice.reducer;
