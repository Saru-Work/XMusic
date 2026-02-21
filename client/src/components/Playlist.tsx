import { useParams } from "react-router-dom";
import PlaylistIcon from "../assets/playlist.jpg";
import type { PlaylistType } from "../types/playlist";
import { Music } from "lucide-react";
const Playlist = ({ playlist }: { playlist: PlaylistType }) => {
  const { playlistId } = useParams();
  return (
    <div className="p-3">
      <div
        className={`flex flex-col gap-2 hover:bg-linear-to-b hover:from-[rgba(255,255,255,0.2)] hover:to-[rgba(255,255,255,0.07)]
 p-2 transition-all rounded-[4px] text-white ${playlistId === playlist._id && " bg-[rgba(0,0,0,0.3)]"}
  hover:scale-105`}
      >
        <div className="w-40 h-40 flex items-center justify-center bg-gray-500 mb-5 rounded-[4px] ">
          {!playlist?.coverImage ? (
            <Music size={72} />
          ) : (
            <img className="object-bottom" src={playlist.coverImage} />
          )}
        </div>
        <div>
          <h2 className="text-sm">{playlist.title}</h2>
          <h3 className="text-[0.7rem] text-gray-400">Creator Name</h3>
        </div>
      </div>
    </div>
  );
};

export default Playlist;
