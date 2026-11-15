import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ListPlus } from "lucide-react";
import type { PlaylistType } from "../types/playlist";
import type { SongType } from "../types/song";
import { api, errorMessage } from "@/lib/api";
import { Spinner, iconButton } from "./States";

type Status =
  | { kind: "idle" }
  | { kind: "saving"; playlistId: string }
  | { kind: "added"; title: string }
  | { kind: "error"; message: string };

/** Saves a YouTube song (from search) to one of the listener's playlists */
const AddToPlaylistButton = ({ song }: { song: SongType }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistType[] | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

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

  async function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    setStatus({ kind: "idle" });
    try {
      const data = await api<{ playlists: PlaylistType[] }>("/playlist/all");
      setPlaylists(data.playlists);
    } catch (err) {
      setStatus({ kind: "error", message: errorMessage(err) });
    }
  }

  async function addTo(playlist: PlaylistType) {
    setStatus({ kind: "saving", playlistId: playlist._id });
    try {
      await api(`/playlist/${playlist._id}/youtube`, {
        method: "POST",
        json: { videoId: song.youtubeId, duration: song.duration },
      });
      setStatus({ kind: "added", title: playlist.title });
    } catch (err) {
      setStatus({ kind: "error", message: errorMessage(err) });
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={iconButton}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Add ${song.title} to a playlist`}
        title="Add to playlist"
      >
        <ListPlus size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-56 rounded-[4px] bg-[#1F1F1F] p-2 text-sm shadow-2xl"
        >
          <p className="px-2 pb-1 text-xs text-gray-400">Add to playlist</p>
          {status.kind === "added" ? (
            <p role="status" className="flex items-center gap-2 px-2 py-2 text-emerald-400">
              <Check size={14} /> Added to {status.title}
            </p>
          ) : status.kind === "error" ? (
            <p role="alert" className="px-2 py-2 text-red-400">
              {status.message}
            </p>
          ) : playlists === null ? (
            <p className="flex items-center gap-2 px-2 py-2 text-gray-400">
              <Spinner size={14} /> Loading…
            </p>
          ) : playlists.length === 0 ? (
            <p className="px-2 py-2 text-gray-300">
              You don't have a playlist yet.{" "}
              <Link to="/myPlaylists" className="text-white underline">
                Create one
              </Link>
            </p>
          ) : (
            <ul className="max-h-56 overflow-auto">
              {playlists.map((playlist) => (
                <li key={playlist._id} role="none">
                  <button
                    role="menuitem"
                    disabled={status.kind === "saving"}
                    onClick={() => addTo(playlist)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-left hover:bg-white/10 disabled:opacity-60"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {playlist.title}
                    </span>
                    {status.kind === "saving" &&
                      status.playlistId === playlist._id && <Spinner size={12} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default AddToPlaylistButton;
