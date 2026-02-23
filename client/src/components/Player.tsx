import useSound from "use-sound";
import type { SongType } from "../types/song";
import { useEffect, useState } from "react";
import type { AlbumType } from "../types/album";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

const Player = ({ song }: { song: SongType }) => {
  // const { song } = useSelector((s: RootState) => s.song);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [play, { stop, sound }] = useSound(song?.url);
  const [album, setAlbum] = useState<AlbumType>();

  useEffect(() => {
    async function fetchAlbum() {
      const res = await fetch(`http://localhost:3000/album/${song.album}`);
      const json = await res.json();
      setAlbum(json.album);
    }
    fetchAlbum();
  }, [song]);
  useEffect(() => {
    sound?.play();
    setIsPlaying(true);
    return () => {
      sound?.unload();
      setIsPlaying(false);
    };
  }, [sound]);
  return (
    <div
      style={{
        background: `linear-gradient(${album?.colors[0].hex}, black)`,
      }}
      key={song.url}
      className="flex-2 flex flex-col items-center px-10 py-12 max-w-[300px] bg-[#222222] h-full rounded-[4px]"
    >
      <img className="w-50" src={album?.photoUrl} alt="" />
      <h2 className="text-white text-sm p-4">{song?.title}</h2>
      <div className="flex items-center gap-4 py-2">
        <button>
          <SkipBack size={15} fill="white" className="text-white" />
        </button>
        <button
          onClick={() => {
            if (isPlaying) {
              stop();
              setIsPlaying(false);
            } else {
              play();
              setIsPlaying(true);
            }
          }}
        >
          {!isPlaying ? (
            <div className="w-8 h-8 flex items-center justify-center bg-white rounded-full cursor-pointer">
              <Play size={15} fill="black" />
            </div>
          ) : (
            <div className="w-8 h-8 flex items-center justify-center bg-white rounded-full cursor-pointer">
              <Pause size={15} fill="black" />
            </div>
          )}
        </button>
        <button>
          <SkipForward color="white" fill="white" size={16} />
        </button>
      </div>
    </div>
  );
};

export default Player;
