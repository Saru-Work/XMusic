import { Music } from "lucide-react";
import type { AlbumType } from "../pages/MyAlbums";

const Album = ({ album }: { album: AlbumType }) => {
  return (
    <div className="p-3">
      <div
        className={`flex flex-col gap-2 hover:bg-linear-to-b hover:from-[rgba(255,255,255,0.2)] hover:to-[rgba(255,255,255,0.07)]
 p-2 transition-all rounded-[4px] text-white
  hover:scale-105`}
      >
        <div className="w-40 h-40 flex items-center justify-center mb-5 rounded-[4px] ">
          {!album?.photoUrl ? (
            <div className="w-40 h-40 bg-gray-500 rounded-[4px]">
              <Music size={72} />
            </div>
          ) : (
            <img className="object-bottom" src={album.photoUrl} />
          )}
        </div>
        <div>
          <h2 className="text-sm">{album.title}</h2>
          <h3 className="text-[0.7rem] text-gray-400">Creator Name</h3>
        </div>
      </div>
    </div>
  );
};

export default Album;
