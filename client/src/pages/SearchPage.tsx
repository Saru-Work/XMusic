import { SearchIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import Album from "../components/Album";
import Artist from "../components/Artist";
import Song from "../components/Song";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
} from "../components/States";
import type { AlbumType } from "../types/album";
import type { ArtistType } from "../types/artist";
import type { SongType } from "../types/song";
import { useApi } from "@/lib/api";
import { artistOf } from "@/lib/format";

const SearchPage = () => {
  const [params] = useSearchParams();
  const query = (params.get("q") ?? "").trim();
  const q = query.toLowerCase();
  const songsApi = useApi<{ songs: SongType[] }>("/songs");
  const artistsApi = useApi<{ artists: ArtistType[] }>("/artists");
  const albumsApi = useApi<{ albums: AlbumType[] }>("/album");

  const loading = songsApi.loading || artistsApi.loading || albumsApi.loading;
  const error = songsApi.error || artistsApi.error || albumsApi.error;
  const matches = (text: string | undefined) =>
    Boolean(text?.toLowerCase().includes(q));

  const songs = (songsApi.data?.songs ?? []).filter(
    (s) => matches(s.title) || matches(artistOf(s.artist)?.title),
  );
  const artists = (artistsApi.data?.artists ?? []).filter((a) =>
    matches(a.title),
  );
  const albums = (albumsApi.data?.albums ?? []).filter(
    (a) => matches(a.title) || matches(artistOf(a.artist)?.title),
  );
  const empty = !songs.length && !artists.length && !albums.length;

  return (
    <div className="min-h-full space-y-6 p-5">
      <PageTitle title={query ? `Results for "${query}"` : "Search"} />
      {!query ? (
        <EmptyState icon={SearchIcon} title="Search for songs, artists or albums" />
      ) : loading ? (
        <LoadingState label="Searching…" />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            songsApi.reload();
            artistsApi.reload();
            albumsApi.reload();
          }}
        />
      ) : empty ? (
        <EmptyState icon={SearchIcon} title={`Nothing found for "${query}"`}>
          Check the spelling or try a different search.
        </EmptyState>
      ) : (
        <>
          {artists.length > 0 && (
            <section>
              <h2 className="mb-2 text-white">Artists</h2>
              <div className="flex flex-wrap gap-1">
                {artists.map((artist) => (
                  <Artist key={artist._id} artist={artist} />
                ))}
              </div>
            </section>
          )}
          {albums.length > 0 && (
            <section>
              <h2 className="mb-2 text-white">Albums</h2>
              <div className="flex flex-wrap gap-1">
                {albums.map((album) => (
                  <Album key={album._id} album={album} />
                ))}
              </div>
            </section>
          )}
          {songs.length > 0 && (
            <section>
              <h2 className="mb-2 text-white">Tracks</h2>
              {songs.map((song) => (
                <Song key={song._id} song={song} queue={songs} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default SearchPage;
