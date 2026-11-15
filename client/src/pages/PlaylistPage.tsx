import { useState } from "react";
import type { PlaylistType } from "../types/playlist";
import { useNavigate, useParams } from "react-router-dom";
import { ListMusic, Music, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import Modal from "../components/Modal";
import UpdatePlaylistForm from "../components/UpdatePlaylistForm";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import AddSongsToPlaylistForm from "../components/AddSongsToPlaylistForm";
import Song from "../components/Song";
import CoverImage from "../components/CoverImage";
import { playQueue } from "../reducers/songSlice";
import { api, errorMessage, useApi } from "@/lib/api";
import { plural } from "@/lib/format";
import {
  EmptyState,
  ErrorState,
  FormError,
  LoadingState,
  iconButton,
  secondaryButton,
} from "../components/States";

const PlaylistPage = () => {
  const { user } = useSelector((s: RootState) => s.user);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { playlistId } = useParams();
  const [openEdit, setOpenEdit] = useState(false);
  const [openSongAdd, setOpenSongAdd] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, error, loading, reload, setData } = useApi<{
    playlist: PlaylistType;
  }>(`/playlist/get/${playlistId}`);

  if (loading) return <LoadingState />;
  if (error || !data) {
    return (
      <ErrorState message={error ?? "Playlist not found!"} onRetry={reload} />
    );
  }
  const playlist = data.playlist;
  // Songs whose artist profile was removed come back as null from the API
  const songs = playlist.songs.filter(Boolean);
  const isOwner = Boolean(user?._id && user._id === playlist.user);
  const update = (changes: Partial<PlaylistType>) =>
    setData((d) => ({ playlist: { ...d.playlist, ...changes } }));

  async function removeSong(songId: string) {
    setActionError(null);
    try {
      await api(`/playlist/${playlist._id}/song/${songId}`, {
        method: "DELETE",
      });
      update({ songs: songs.filter((s) => s._id !== songId) });
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  async function deletePlaylist() {
    if (!window.confirm(`Delete the playlist "${playlist.title}"?`)) return;
    setActionError(null);
    try {
      await api(`/playlist/${playlist._id}`, { method: "DELETE" });
      navigate("/myPlaylists");
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <div className="min-h-full text-white">
      <Modal
        title="Add songs"
        open={openSongAdd}
        onClose={() => setOpenSongAdd(false)}
      >
        <AddSongsToPlaylistForm
          playlistId={playlist._id}
          playlistSongs={songs}
          onAdded={(song) => update({ songs: [...songs, song] })}
          onClose={() => setOpenSongAdd(false)}
        />
      </Modal>
      <Modal
        title="Edit playlist"
        open={openEdit}
        onClose={() => setOpenEdit(false)}
      >
        <UpdatePlaylistForm
          playlist={playlist}
          onSaved={update}
          onClose={() => setOpenEdit(false)}
        />
      </Modal>
      <div className="flex flex-col gap-5 bg-linear-to-r from-[rgba(255,255,255,0.2)] to-[rgba(255,255,255,0.05)] p-5 sm:flex-row sm:items-end">
        <CoverImage
          src={playlist.coverImage}
          alt={`${playlist.title} cover`}
          icon={ListMusic}
          className="w-40 shadow-2xl"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-white/70">
            Playlist
          </p>
          <h1 className="wrap-break-word text-4xl md:text-6xl">
            {playlist.title}
          </h1>
          {playlist.description && (
            <p className="mt-2 text-sm text-white/80">{playlist.description}</p>
          )}
          <p className="mt-2 text-sm text-white/70">
            {plural(songs.length, "track")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {isOwner && (
            <>
              <button
                className={iconButton}
                onClick={() => setOpenEdit(true)}
                aria-label="Edit playlist"
                title="Edit playlist"
              >
                <Pencil size={18} />
              </button>
              <button
                className={iconButton}
                onClick={deletePlaylist}
                aria-label="Delete playlist"
                title="Delete playlist"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
          <button
            onClick={() => dispatch(playQueue({ songs }))}
            disabled={songs.length === 0}
            aria-label="Play playlist"
            title={songs.length ? "Play" : "Add songs to play this playlist"}
            className="ml-2 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-linear-to-r from-amber-400 to-amber-700 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            <Play fill="white" size={24} className="translate-x-px" />
          </button>
        </div>
      </div>
      <div className="p-5">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-lg">Tracks</h2>
          {isOwner && (
            <button
              className={secondaryButton}
              onClick={() => setOpenSongAdd(true)}
            >
              <Plus size={14} /> Add songs
            </button>
          )}
        </header>
        <FormError message={actionError} />
        {songs.length === 0 ? (
          <EmptyState icon={Music} title="This playlist is empty">
            {isOwner && "Use “Add songs” to start filling it."}
          </EmptyState>
        ) : (
          songs.map((song) => (
            <Song
              key={song._id}
              song={song}
              queue={songs}
              action={
                isOwner && (
                  <button
                    className={iconButton}
                    onClick={() => removeSong(song._id)}
                    aria-label={`Remove ${song.title} from playlist`}
                    title="Remove from playlist"
                  >
                    <X size={14} />
                  </button>
                )
              }
            />
          ))
        )}
      </div>
    </div>
  );
};

export default PlaylistPage;
