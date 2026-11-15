import { Disc3 } from "lucide-react";
import Album from "../components/Album";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
} from "../components/States";
import type { AlbumType } from "../types/album";
import { useApi } from "@/lib/api";

const AlbumsPage = () => {
  const { data, error, loading, reload } = useApi<{ albums: AlbumType[] }>(
    "/album",
  );
  return (
    <div className="min-h-full p-5">
      <PageTitle title="Albums" />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data?.albums.length ? (
        <div className="flex flex-wrap gap-1">
          {data.albums.map((album) => (
            <Album album={album} key={album._id} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Disc3} title="No albums yet" />
      )}
    </div>
  );
};

export default AlbumsPage;
