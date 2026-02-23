import React, { useEffect, useState } from "react";
import type { SongType } from "../types/song";
import { Play } from "lucide-react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store/store";
import { storeSong } from "../reducers/songSlice";
import type { AlbumType } from "../types/album";
interface Props {
  song: SongType;
  isArtist: boolean;
}
function converToMinutes(duration: number) {
  if (duration < 60) {
    return `0:${duration}`;
  }
  return `${Math.floor(duration / 60)}:${duration % 60}`;
}
const Song = ({ song, isArtist }: Props) => {
  const [album, setAlbum] = useState<AlbumType>();
  const [hovered, setHovered] = useState(false);
  const dispatch = useDispatch<AppDispatch>();
  useEffect(() => {
    async function getAlbum() {
      const res = await fetch(`http://localhost:3000/album/${song.album}`);
      const json = await res.json();
      setAlbum(json.album);
    }
    getAlbum();
  }, []);
  return (
    <div
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      onClick={() => {
        dispatch(storeSong(song));
      }}
      className="flex cursor-pointer justify-between items-center py-2 text-white font-thin text-sm border-b-[0.5px]"
    >
      <div className="flex items-center gap-2 transition-all w-45">
        <Play
          size={15}
          fill="white"
          className={`transition-all duration-300 ease-out 
    ${
      hovered
        ? "opacity-100 scale-100 translate-x-0"
        : "opacity-0 scale-75 translate-x-2"
    }
  `}
        />
        <div
          className={`transition-all duration-300 ease-out 
    ${hovered ? "translate-x-0" : "-translate-x-6"}
  `}
        >
          {song.title}
        </div>
      </div>
      <div className="flex gap-2 w-50">
        <div className="w-40">{isArtist && album?.title}</div>
        <div className="text-[0.8rem]">{converToMinutes(song.duration)}</div>
      </div>
    </div>
  );
};

export default Song;
