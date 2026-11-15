import { ListMusic, Plus } from "lucide-react";
import { useState } from "react";
import Playlist from "./Playlist";
import { useNavigate } from "react-router-dom";
import type { PlaylistType } from "../types/playlist";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { api, errorMessage, useApi } from "@/lib/api";
import LoginPrompt from "./LoginPrompt";
import {
  EmptyState,
  ErrorState,
  FormError,
  LoadingState,
  PageTitle,
  Spinner,
  primaryButton,
} from "./States";

const Playlists = () => {
  const { user, initialized } = useSelector((s: RootState) => s.user);
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApi<{
    playlists: PlaylistType[];
  }>(user ? "/playlist/all" : null);
  const playlists = data?.playlists ?? [];
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function createPlaylist() {
    setCreateError(null);
    setCreating(true);
    try {
      const json = await api<{ playlist: PlaylistType }>("/playlist/create", {
        method: "POST",
        json: { title: `My Playlist #${playlists.length + 1}` },
      });
      // Open the new playlist so it can be renamed and filled right away
      navigate(`/playlist/${json.playlist._id}`);
    } catch (err) {
      setCreateError(errorMessage(err));
      setCreating(false);
    }
  }

  const newButton = (label: string) => (
    <button className={primaryButton} onClick={createPlaylist} disabled={creating}>
      {creating ? <Spinner size={14} /> : <Plus size={14} />} {label}
    </button>
  );

  return (
    <div className="min-h-full p-5">
      <PageTitle title="Your Playlists">
        {user && playlists.length > 0 && newButton("New playlist")}
      </PageTitle>
      <FormError message={createError} />
      {!initialized || loading ? (
        <LoadingState />
      ) : !user ? (
        <LoginPrompt message="Log in to create and see your playlists." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : playlists.length === 0 ? (
        <EmptyState icon={ListMusic} title="You don't have any playlists yet">
          {newButton("Create your first playlist")}
        </EmptyState>
      ) : (
        <div className="flex flex-wrap gap-1">
          {playlists.map((playlist) => (
            <Playlist key={playlist._id} playlist={playlist} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Playlists;
