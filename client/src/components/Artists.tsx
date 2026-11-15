import type { ArtistType } from "../types/artist";
import Artist from "./Artist";
import { Link } from "react-router-dom";
import { useApi } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState } from "./States";

const Artists = () => {
  const { data, error, loading, reload } = useApi<{ artists: ArtistType[] }>(
    "/artists",
  );
  const artists = data?.artists ?? [];
  return (
    <section className="rounded-[4px] bg-linear-to-r from-[rgba(255,255,255,0.08)] to-[rgba(255,255,255,0.02)] p-4">
      <header className="flex items-center justify-between px-2 py-2">
        <h2 className="font-medium text-white">Top Artists</h2>
        {artists.length > 0 && (
          <Link to="/artists" className="text-sm text-slate-400 hover:text-white">
            See all
          </Link>
        )}
      </header>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : artists.length === 0 ? (
        <EmptyState title="No artists yet">
          Be the first: open your profile menu and choose "Become an artist".
        </EmptyState>
      ) : (
        <div className="flex gap-1 overflow-x-auto">
          {artists.map((artist) => (
            <Artist artist={artist} key={artist._id} />
          ))}
        </div>
      )}
    </section>
  );
};

export default Artists;
