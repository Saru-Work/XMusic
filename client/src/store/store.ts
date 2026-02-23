import { configureStore } from "@reduxjs/toolkit";
import userReducer from "../reducers/userReducer";
import songReducer from "../reducers/songSlice";
export const store = configureStore({
  reducer: { user: userReducer, song: songReducer },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
