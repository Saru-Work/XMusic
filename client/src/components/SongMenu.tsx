import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Ellipsis, ListEnd, ListStart } from "lucide-react";
import type { AppDispatch } from "../store/store";
import type { SongType } from "../types/song";
import { addToQueue, playNext } from "../reducers/songSlice";
import { showToast } from "../reducers/toastSlice";
import { iconButton } from "./States";

const item =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-left hover:bg-white/10";

/** "More" menu on a song row: queue actions */
const SongMenu = ({ song }: { song: SongType }) => {
  const dispatch = useDispatch<AppDispatch>();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={iconButton}
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More options for ${song.title}`}
        title="More"
      >
        <Ellipsis size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-44 rounded-[4px] bg-[#1F1F1F] p-1 text-sm text-white shadow-2xl"
        >
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              dispatch(playNext(song));
              dispatch(showToast("Playing next"));
              setOpen(false);
            }}
          >
            <ListStart size={14} /> Play next
          </button>
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              dispatch(addToQueue(song));
              dispatch(showToast("Added to queue"));
              setOpen(false);
            }}
          >
            <ListEnd size={14} /> Add to queue
          </button>
        </div>
      )}
    </div>
  );
};

export default SongMenu;
