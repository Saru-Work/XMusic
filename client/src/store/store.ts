import { configureStore } from "@reduxjs/toolkit";
import userReducer from "../reducers/userReducer";
import songReducer, {
  savePlayerPrefs,
  savePlayerSession,
} from "../reducers/songSlice";
import likesReducer from "../reducers/likesSlice";
import toastReducer from "../reducers/toastSlice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    song: songReducer,
    likes: likesReducer,
    toast: toastReducer,
  },
});

// Remember shuffle / repeat, the queue and the listening history between visits
let saved = store.getState().song;
store.subscribe(() => {
  const player = store.getState().song;
  if (player.shuffle !== saved.shuffle || player.repeat !== saved.repeat) {
    savePlayerPrefs(player);
  }
  if (
    player.queue !== saved.queue ||
    player.source !== saved.source ||
    player.index !== saved.index ||
    player.history !== saved.history
  ) {
    savePlayerSession(player);
  }
  saved = player;
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
