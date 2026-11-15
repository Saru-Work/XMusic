import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { hideToast } from "../reducers/toastSlice";

/** Shows the latest confirmation message for a few seconds */
const Toaster = () => {
  const toast = useSelector((s: RootState) => s.toast.current);
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => dispatch(hideToast()), 2600);
    return () => window.clearTimeout(timer);
  }, [toast, dispatch]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4"
    >
      {toast && (
        <p
          key={toast.id}
          role={toast.kind === "error" ? "alert" : "status"}
          className={`max-w-sm rounded-full px-4 py-2 text-sm shadow-2xl ${
            toast.kind === "error"
              ? "bg-red-600 text-white"
              : "bg-white text-black"
          }`}
        >
          {toast.message}
        </p>
      )}
    </div>
  );
};

export default Toaster;
