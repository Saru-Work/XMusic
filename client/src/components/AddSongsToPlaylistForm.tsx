import { useState } from "react";
import type { SongType } from "../types/song";
import { Check, Plus, SearchIcon } from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/api";
import { artistOf, formatDuration } from "@/lib/format";
import {
  EmptyState,
  ErrorState,
  FormError,
  LoadingState,
  Spinner,
  primaryButton,
  textInput,
} from "./States";

const AddSongsToPlaylistForm = ({
  playlistId,
  playlistSongs,
  onAdded,
  onClose,
}: {
  playlistId: string;
  /** Songs already in the playlist */
  playlistSongs: SongType[];
  onAdded: (song: SongType) => void;
  onClose: () => void;
}) => {
  const { data, error, loading, reload } = useApi<{ songs: SongType[] }>(
    "/songs",
  );
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const inPlaylist = new Set(playlistSongs.map((s) => s._id));
  const q = query.trim().toLowerCase();
  const results = (data?.songs ?? []).filter(
    (song) =>
      !q ||
      song.title.toLowerCase().includes(q) ||
      artistOf(song.artist)?.title.toLowerCase().includes(q),
  );

  async function addSong(song: SongType) {
    setAddError(null);
    setAddingId(song._id);
    try {
      await api(`/playlist/${playlistId}/song/${song._id}`, { method: "POST" });
      onAdded(song);
    } catch (err) {
      setAddError(errorMessage(err));
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          className={`${textInput} pl-9`}
          type="search"
          autoFocus
          aria-label="Filter songs"
          placeholder="Filter by song or artist"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <FormError message={addError} />
      <div className="h-72 overflow-auto">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : results.length === 0 ? (
          <EmptyState
            title={q ? `No songs match "${query.trim()}"` : "No songs available yet"}
          />
        ) : (
          <ul className="space-y-1">
            {results.map((song) => {
              const added = inPlaylist.has(song._id);
              return (
                <li
                  key={song._id}
                  className="flex items-center gap-3 rounded-sm bg-white/5 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{song.title}</div>
                    <div className="truncate text-xs text-gray-400">
                      {artistOf(song.artist)?.title}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 tabular-nums">
                    {formatDuration(song.duration)}
                  </span>
                  <button
                    type="button"
                    disabled={added || addingId === song._id}
                    onClick={() => addSong(song)}
                    aria-label={
                      added ? `${song.title} is in the playlist` : `Add ${song.title}`
                    }
                    className={`flex w-20 items-center justify-center gap-1 rounded-full border px-2 py-1 text-xs ${
                      added
                        ? "border-transparent text-emerald-400"
                        : "cursor-pointer border-white/30 hover:bg-white/10"
                    }`}
                  >
                    {addingId === song._id ? (
                      <Spinner size={12} />
                    ) : added ? (
                      <>
                        <Check size={12} /> Added
                      </>
                    ) : (
                      <>
                        <Plus size={12} /> Add
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="flex justify-end">
        <button type="button" className={primaryButton} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
};

export default AddSongsToPlaylistForm;
