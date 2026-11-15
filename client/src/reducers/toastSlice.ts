import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface Toast {
  id: number;
  message: string;
  kind: "info" | "error";
}

/** One short confirmation message at a time, shown by <Toaster /> */
const toastSlice = createSlice({
  name: "toast",
  initialState: { current: null as Toast | null },
  reducers: {
    showToast: {
      reducer(state, action: PayloadAction<Toast>) {
        state.current = action.payload;
      },
      prepare(message: string, kind: Toast["kind"] = "info") {
        return { payload: { id: Date.now() + Math.random(), message, kind } };
      },
    },
    hideToast(state) {
      state.current = null;
    },
  },
});

export const { showToast, hideToast } = toastSlice.actions;
export default toastSlice.reducer;
