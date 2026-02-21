import { useEffect, useState } from "react";
import type { PlaylistType } from "../types/playlist";
import { useParams } from "react-router-dom";
import { Music, Play } from "lucide-react";
import Modal from "../components/Modal";
import UpdatePlaylistForm from "../components/UpdatePlaylistForm";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";

const PlaylistPage = () => {
  const [playlist, setPlaylist] = useState<PlaylistType | null>();
  const { user } = useSelector((s: RootState) => s.user);
  const { playlistId } = useParams();
  const [openModal, setOpenModal] = useState(false);
  useEffect(() => {
    async function fetchPlaylist() {
      const res = await fetch(
        `http://localhost:3000/playlist/get/${playlistId}`,
      );
      const json = await res.json();
      setPlaylist(json.playlist);
    }
    fetchPlaylist();
  }, [playlistId]);
  return (
    <div className="text-white">
      <Modal
        open={openModal}
        onClose={() => {
          setOpenModal(false);
        }}
      >
        <UpdatePlaylistForm
          setPlaylist={setPlaylist}
          playlist={playlist}
          onClose={() => {
            setOpenModal(false);
          }}
        />
      </Modal>
      <div className="h-[calc(100vh-92px)] rounded-[4px] bg-[rgba(255,255,255,0.05)]">
        <div className="rounded-t-[4px] p-5 bg-linear-to-r from-[rgba(255,255,255,0.2)] to-[rgba(255,255,255,0.05)]">
          <div className="flex gap-2">
            <div className="w-40 h-40 flex items-center justify-center bg-gray-500 mb-5 ">
              {!playlist?.coverImage ? (
                <Music size={72} />
              ) : (
                <img className="object-bottom" src={playlist.coverImage} />
              )}
            </div>
            <p>{playlist?.description}</p>
          </div>
          <div className="flex justify-between items-center">
            <h2
              onClick={() => {
                if (user) {
                  if (user._id === playlist?.user) {
                    setOpenModal(true);
                  }
                }
              }}
              className="text-8xl"
            >
              {playlist?.title}
            </h2>
            <div className="w-20 h-20 rounded-full bg-linear-to-r from-amber-400 to-amber-700 hover:to-amber-800 transition-all duration-1000 flex items-center justify-center cursor-pointer">
              <Play fill="white" size={36} />
            </div>
          </div>
        </div>
        <div className="p-5 text-lg">
          <h2>Tracks</h2>
        </div>
      </div>
    </div>
  );
};

export default PlaylistPage;
