import { configureStore } from "@reduxjs/toolkit";
import userReducer from "../reducers/userReducer";
import songReducer, { savePlayerPrefs } from "../reducers/songSlice";
export const store = configureStore({
  reducer: { user: userReducer, song: songReducer },
});

// Remember shuffle / repeat between visits
let savedPrefs = "";
store.subscribe(() => {
  const { shuffle, repeat } = store.getState().song;
  const prefs = `${shuffle}:${repeat}`;
  if (prefs !== savedPrefs) {
    savedPrefs = prefs;
    savePlayerPrefs({ shuffle, repeat });
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
