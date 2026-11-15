import { MicVocal } from "lucide-react";
import Artist from "../components/Artist";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
} from "../components/States";
import type { ArtistType } from "../types/artist";
import { useApi } from "@/lib/api";

const ArtistsPage = () => {
  const { data, error, loading, reload } = useApi<{ artists: ArtistType[] }>(
    "/artists",
  );
  return (
    <div className="min-h-full p-5">
      <PageTitle title="Artists" />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data?.artists.length ? (
        <div className="flex flex-wrap gap-1">
          {data.artists.map((artist) => (
            <Artist artist={artist} key={artist._id} />
          ))}
        </div>
      ) : (
        <EmptyState icon={MicVocal} title="No artists yet" />
      )}
    </div>
  );
};

export default ArtistsPage;
