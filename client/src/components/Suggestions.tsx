import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useApi } from "@/lib/api";
import type { AlbumType } from "../types/album";
import type { PlaylistType } from "../types/playlist";
import type { SongType } from "../types/song";
import Album from "./Album";
import Playlist from "./Playlist";
import Song from "./Song";
import { ErrorState, LoadingState } from "./States";

interface SuggestionsResponse {
  songs: SongType[];
  albums: AlbumType[];
  /** `songs` holds ids here; only the count is shown */
  playlists: PlaylistType[];
}

function Section({
  title,
  onRefresh,
  children,
}: {
  title: string;
  onRefresh: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[4px] bg-white/5 p-4">
      <header className="flex items-center justify-between px-2 py-2">
        <h2 className="font-medium text-white">{title}</h2>
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
          title="Show different suggestions"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </header>
      {children}
    </section>
  );
}

/** Random songs, albums and playlists, picked fresh on every load. */
const Suggestions = () => {
  const { data, error, loading, reload } =
    useApi<SuggestionsResponse>("/suggestions");

  if (loading) {
    return (
      <section className="rounded-[4px] bg-white/5 p-4">
        <LoadingState />
      </section>
    );
  }
  if (error) {
    return (
      <section className="rounded-[4px] bg-white/5 p-4">
        <ErrorState message={error} onRetry={reload} />
      </section>
    );
  }

  const songs = data?.songs ?? [];
  const albums = data?.albums ?? [];
  const playlists = data?.playlists ?? [];

  return (
    <>
      {songs.length > 0 && (
        <Section title="Songs You Might Like" onRefresh={reload}>
          {songs.map((song) => (
            <Song key={song._id} song={song} queue={songs} />
          ))}
        </Section>
      )}
      {albums.length > 0 && (
        <Section title="Albums to Explore" onRefresh={reload}>
          <div className="flex gap-1 overflow-x-auto">
            {albums.map((album) => (
              <Album album={album} key={album._id} />
            ))}
          </div>
        </Section>
      )}
      {playlists.length > 0 && (
        <Section title="Playlists from Listeners" onRefresh={reload}>
          <div className="flex gap-1 overflow-x-auto">
            {playlists.map((playlist) => (
              <Playlist playlist={playlist} key={playlist._id} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
};

export default Suggestions;
