import { useParams } from "react-router-dom";
import { MicVocal, Music, Play } from "lucide-react";
import { useDispatch } from "react-redux";
import type { ArtistType } from "../types/artist";
import type { SongType } from "../types/song";
import type { AlbumType } from "../types/album";
import type { AppDispatch } from "../store/store";
import { playQueue } from "../reducers/songSlice";
import Song from "../components/Song";
import Album from "../components/Album";
import CoverImage from "../components/CoverImage";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  primaryButton,
} from "../components/States";
import { useApi } from "@/lib/api";

const ArtistPage = () => {
  const { artistId } = useParams();
  const dispatch = useDispatch<AppDispatch>();
  const { data, error, loading, reload } = useApi<{
    artist: ArtistType;
    songs: SongType[];
    albums: AlbumType[];
  }>(`/artist/${artistId}`);

  if (loading) return <LoadingState />;
  if (error || !data) {
    return <ErrorState message={error ?? "Artist not found!"} onRetry={reload} />;
  }
  const { artist, songs, albums } = data;
  const albumTitles = new Map(albums.map((a) => [a._id, a.title]));

  return (
    <div className="min-h-full space-y-8 bg-[#211F27] p-5 md:p-10">
      <div className="flex flex-col-reverse gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-white/70">Artist</p>
          <h1 className="wrap-break-word text-4xl text-white md:text-6xl">
            {artist.title}
          </h1>
          {artist.bio && (
            <p className="mt-3 max-w-prose text-sm text-gray-300">{artist.bio}</p>
          )}
        </div>
        <CoverImage
          src={artist.profileUrl}
          alt={artist.title}
          icon={MicVocal}
          className="w-40 rounded-full"
        />
      </div>
      <section>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-white">Tracks</h2>
          {songs.length > 0 && (
            <button
              className={primaryButton}
              onClick={() => dispatch(playQueue({ songs }))}
            >
              <Play size={14} fill="black" /> Play
            </button>
          )}
        </header>
        {songs.length === 0 ? (
          <EmptyState icon={Music} title="No tracks yet" />
        ) : (
          songs.map((song) => (
            <Song
              key={song._id}
              song={song}
              queue={songs}
              subtitle={song.album ? albumTitles.get(song.album) : undefined}
            />
          ))
        )}
      </section>
      {albums.length > 0 && (
        <section>
          <h2 className="mb-3 text-white">Albums</h2>
          <div className="flex flex-wrap gap-1 rounded-[4px] bg-white/5 p-2">
            {albums.map((album) => (
              <Album album={album} key={album._id} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ArtistPage;
