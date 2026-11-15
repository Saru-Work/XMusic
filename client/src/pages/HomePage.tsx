import { Link } from "react-router-dom";
import banner from "../assets/banner.png";
import Artists from "../components/Artists";
import Album from "../components/Album";
import Song from "../components/Song";
import type { AlbumType } from "../types/album";
import type { SongType } from "../types/song";
import { useApi } from "@/lib/api";

function HomePage() {
  const albums = useApi<{ albums: AlbumType[] }>("/album").data?.albums ?? [];
  const songs = useApi<{ songs: SongType[] }>("/songs").data?.songs ?? [];
  const latest = songs.slice(0, 8);

  return (
    <div className="min-h-full space-y-5 p-5">
      <img
        className="max-h-72 w-full rounded-[4px] object-cover"
        src={banner}
        alt=""
      />
      <Artists />
      {albums.length > 0 && (
        <section className="rounded-[4px] bg-white/5 p-4">
          <header className="flex items-center justify-between px-2 py-2">
            <h2 className="font-medium text-white">New Albums</h2>
            <Link to="/albums" className="text-sm text-slate-400 hover:text-white">
              See all
            </Link>
          </header>
          <div className="flex gap-1 overflow-x-auto">
            {albums.slice(0, 12).map((album) => (
              <Album album={album} key={album._id} />
            ))}
          </div>
        </section>
      )}
      {latest.length > 0 && (
        <section className="rounded-[4px] bg-white/5 p-4">
          <header className="flex items-center justify-between px-2 py-2">
            <h2 className="font-medium text-white">Latest Tracks</h2>
            <Link to="/tracks" className="text-sm text-slate-400 hover:text-white">
              See all
            </Link>
          </header>
          {latest.map((song) => (
            <Song key={song._id} song={song} queue={latest} />
          ))}
        </section>
      )}
    </div>
  );
}

export default HomePage;
