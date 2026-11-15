import { useState } from "react";
import { useSelector } from "react-redux";
import { CircleCheck, MicVocal } from "lucide-react";
import type { RootState } from "../store/store";
import type { SongType } from "../types/song";
import UploadSong from "../components/UploadSong";
import LoginPrompt from "../components/LoginPrompt";
import { EmptyState, LoadingState, PageTitle } from "../components/States";

/** Upload a single: a song that doesn't belong to an album */
const UploadPage = () => {
  const { user, initialized } = useSelector((s: RootState) => s.user);
  const [uploaded, setUploaded] = useState<SongType[]>([]);

  return (
    <div className="min-h-full p-5">
      <PageTitle title="Upload a single" />
      {!initialized ? (
        <LoadingState />
      ) : !user ? (
        <LoginPrompt message="Log in to upload music." />
      ) : !user.isArtist ? (
        <EmptyState icon={MicVocal} title="Uploading is for artists">
          Open your profile menu and choose "Become an artist" first.
        </EmptyState>
      ) : (
        <div className="max-w-lg space-y-4 rounded-md bg-white/5 p-5">
          <p className="text-sm text-gray-300">
            Singles appear under Tracks and on your artist page. To add a song
            to an album, open the album and use “Add song”.
          </p>
          <UploadSong
            endpoint="/songs/upload"
            titleField="name"
            onUploaded={(song) => setUploaded((songs) => [song, ...songs])}
          />
          {uploaded.length > 0 && (
            <ul role="status" className="space-y-1 text-sm text-emerald-400">
              {uploaded.map((song) => (
                <li key={song._id} className="flex items-center gap-2">
                  <CircleCheck size={14} /> Uploaded “{song.title}”
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadPage;
