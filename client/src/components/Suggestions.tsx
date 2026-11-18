import type { ReactNode } from "react";
import { MonitorPlay, RefreshCw } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useApi } from "@/lib/api";
import { youtubeResultToSong, type YouTubeSuggestions } from "@/lib/youtube";
import type { AlbumType } from "../types/album";
import type { PlaylistType } from "../types/playlist";
import type { SongType } from "../types/song";
import AddToPlaylistButton from "./AddToPlaylistButton";
import Album from "./Album";
import Playlist from "./Playlist";
import Song from "./Song";
import { ErrorState, LoadingState } from "./States";
import YouTubePlaylistCard from "./YouTubePlaylistCard";

interface SuggestionsResponse {
  songs: SongType[];
  albums: AlbumType[];
  /** `songs` holds ids here; only the count is shown */
  playlists: PlaylistType[];
}

function Section({
  title,
  youtube = false,
  onRefresh,
  children,
}: {
  title: string;
  /** Marks the section as coming from YouTube */
  youtube?: boolean;
  onRefresh: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[4px] bg-white/5 p-4">
      <header className="flex items-center justify-between gap-3 px-2 py-2">
        <h2 className="flex min-w-0 items-center gap-2 font-medium text-white">
          {youtube && <MonitorPlay size={16} className="shrink-0 text-red-400" />}
          <span className="truncate">{title}</span>
        </h2>
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

const capitalize = (text: string) =>
  text.replace(/(^|\s)\S/g, (c) => c.toUpperCase());

/**
 * Trending tracks plus albums and playlists for random genres, from YouTube.
 * Loaded separately so a slow or failing YouTube never holds up the rest.
 */
function YouTubeSuggestionSections() {
  const { user } = useSelector((s: RootState) => s.user);
  const { data, error, loading, reload } =
    useApi<YouTubeSuggestions>("/youtube/suggestions");

  if (loading || error) {
    return (
      <Section title="From YouTube" youtube onRefresh={reload}>
        {loading ? (
          <LoadingState label="Loading YouTube suggestions…" />
        ) : (
          <ErrorState message={error!} onRetry={reload} />
        )}
      </Section>
    );
  }

  const tracks = (data?.tracks ?? []).map(youtubeResultToSong);
  const albums = data?.albums ?? [];
  const playlists = data?.playlists ?? [];

  return (
    <>
      {tracks.length > 0 && (
        <Section title="Trending on YouTube" youtube onRefresh={reload}>
          {tracks.map((song) => (
            <Song
              key={song._id}
              song={song}
              queue={tracks}
              action={user ? <AddToPlaylistButton song={song} /> : undefined}
            />
          ))}
        </Section>
      )}
      {albums.length > 0 && (
        <Section
          title={`${capitalize(data!.albumGenre)} Albums on YouTube`}
          youtube
          onRefresh={reload}
        >
          <div className="flex gap-1 overflow-x-auto">
            {albums.map((album) => (
              <YouTubePlaylistCard
                key={album.playlistId}
                playlist={album}
                kind="album"
              />
            ))}
          </div>
        </Section>
      )}
      {playlists.length > 0 && (
        <Section
          title={`${capitalize(data!.playlistGenre)} Playlists on YouTube`}
          youtube
          onRefresh={reload}
        >
          <div className="flex gap-1 overflow-x-auto">
            {playlists.map((playlist) => (
              <YouTubePlaylistCard
                key={playlist.playlistId}
                playlist={playlist}
                kind="playlist"
              />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/** Random songs, albums and playlists from XMusic, picked fresh on every load. */
function LibrarySuggestions() {
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
}

const Suggestions = () => (
  <>
    <LibrarySuggestions />
    <YouTubeSuggestionSections />
  </>
);

export default Suggestions;
