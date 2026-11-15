import { useState } from "react";
import { useSelector } from "react-redux";
import { Disc3, Plus } from "lucide-react";
import Album from "../components/Album";
import CreateAlbumForm from "../components/CreateAlbumForm";
import LoginPrompt from "../components/LoginPrompt";
import Modal from "../components/Modal";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
  primaryButton,
} from "../components/States";
import type { AlbumType } from "../types/album";
import type { RootState } from "../store/store";
import { useApi } from "@/lib/api";

const MyAlbums = () => {
  const { user, initialized } = useSelector((s: RootState) => s.user);
  const [createOpen, setCreateOpen] = useState(false);
  const { data, error, loading, reload } = useApi<{ albums: AlbumType[] }>(
    user?.isArtist ? "/album/myAlbums" : null,
  );

  return (
    <div className="min-h-full p-5">
      <Modal
        title="Create album"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      >
        <CreateAlbumForm onClose={() => setCreateOpen(false)} />
      </Modal>
      <PageTitle title="Your Albums">
        {user?.isArtist && (
          <button className={primaryButton} onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New album
          </button>
        )}
      </PageTitle>
      {!initialized || loading ? (
        <LoadingState />
      ) : !user ? (
        <LoginPrompt message="Log in to manage your albums." />
      ) : !user.isArtist ? (
        <EmptyState icon={Disc3} title="Albums are for artists">
          Open your profile menu and choose "Become an artist" to start
          publishing music.
        </EmptyState>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data?.albums.length ? (
        <div className="flex flex-wrap gap-1">
          {data.albums.map((album) => (
            <Album album={album} key={album._id} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Disc3} title="You haven't created an album yet">
          <button className={primaryButton} onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Create your first album
          </button>
        </EmptyState>
      )}
    </div>
  );
};

export default MyAlbums;
