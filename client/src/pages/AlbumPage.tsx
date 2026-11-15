import { useState } from "react";
import type { AlbumType } from "../types/album";
import { Link, useParams } from "react-router-dom";
import { Disc3, Music, Play, Plus } from "lucide-react";
import Modal from "../components/Modal";
import UploadSong from "../components/UploadSong";
import type { SongType } from "../types/song";
import Song from "../components/Song";
import CoverImage from "../components/CoverImage";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { playQueue } from "../reducers/songSlice";
import { useApi } from "@/lib/api";
import { albumColor, artistOf, plural } from "@/lib/format";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  primaryButton,
  secondaryButton,
} from "../components/States";

const AlbumPage = () => {
  const { user } = useSelector((s: RootState) => s.user);
  const dispatch = useDispatch<AppDispatch>();
  const { albumId } = useParams();
  const [openSongUpload, setOpenSongUpload] = useState(false);
  const { data, error, loading, reload, setData } = useApi<{
    album: AlbumType;
    songs: SongType[];
  }>(`/album/${albumId}`);

  if (loading) return <LoadingState />;
  if (error || !data) {
    return <ErrorState message={error ?? "Album not found!"} onRetry={reload} />;
  }
  const { album, songs } = data;
  const artist = artistOf(album.artist);
  const isOwner = Boolean(user?._id && artist?.user === user._id);
  const color = albumColor(album, 2);

  return (
    <div
      className="min-h-full"
      style={{ background: `linear-gradient(${color}, black 70%)` }}
    >
      <Modal
        title={`Add a song to ${album.title}`}
        open={openSongUpload}
        onClose={() => setOpenSongUpload(false)}
      >
        <UploadSong
          endpoint={`/album/${album._id}/songs`}
          onCancel={() => setOpenSongUpload(false)}
          onUploaded={(song) => {
            setData((d) => ({ ...d, songs: [...d.songs, song] }));
            setOpenSongUpload(false);
          }}
        />
      </Modal>
      <div className="flex flex-col gap-5 p-5 text-white sm:flex-row sm:items-end">
        <CoverImage
          src={album.photoUrl}
          alt={`${album.title} cover`}
          icon={Disc3}
          className="w-48 shadow-2xl"
        />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-white/70">Album</p>
          <h1 className="wrap-break-word text-4xl font-medium md:text-6xl">
            {album.title}
          </h1>
          {album.description && (
            <p className="mt-2 text-sm text-white/80">{album.description}</p>
          )}
          <p className="mt-2 text-sm text-white/80">
            {artist && (
              <>
                <Link
                  to={`/artist/${artist._id}`}
                  className="font-medium text-white hover:underline"
                >
                  {artist.title}
                </Link>
                {" · "}
              </>
            )}
            {plural(songs.length, "track")}
          </p>
        </div>
      </div>
      <div className="p-5">
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-white">Tracks</h2>
          <div className="flex gap-2">
            {isOwner && (
              <button
                className={secondaryButton}
                onClick={() => setOpenSongUpload(true)}
              >
                <Plus size={14} /> Add song
              </button>
            )}
            {songs.length > 0 && (
              <button
                className={primaryButton}
                onClick={() => dispatch(playQueue({ songs }))}
              >
                <Play size={14} fill="black" /> Play
              </button>
            )}
          </div>
        </header>
        {songs.length === 0 ? (
          <EmptyState icon={Music} title="No tracks in this album yet">
            {isOwner && "Use “Add song” to upload the first one."}
          </EmptyState>
        ) : (
          songs.map((song) => <Song key={song._id} song={song} queue={songs} />)
        )}
      </div>
    </div>
  );
};

export default AlbumPage;
