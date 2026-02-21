import React, { useEffect, useState } from "react";
import type { AlbumType } from "./MyAlbums";
import { useParams } from "react-router-dom";
import { usePalette } from "react-palette";

const AlbumPage = () => {
  const [album, setAlbum] = useState<AlbumType | null>(null);
  const img = album
    ? album?.photoUrl
    : "https://res.cloudinary.com/dffbsxhgc/image/upload/v1771665809/banner1_khxbhg.png";
  const { data } = usePalette(img);
  const params = useParams();
  useEffect(() => {
    async function fetchAlbum() {
      const res = await fetch(`http://localhost:3000/album/${params.albumId}`);
      const json = await res.json();
      setAlbum(json.album);
    }
    fetchAlbum();
  }, []);
  return (
    <div
      className={`h-[calc(100vh-92px)] overflow-auto rounded-[4px] bg-linear-to-b from-[${data.vibrant}] to-black`}
      style={{
        background: `linear-gradient(${data.vibrant}, black)`,
      }}
    >
      <div
        style={{
          backgroundColor: data.vibrant,
        }}
        className="text-white flex gap-4 items-end p-5"
      >
        <div>
          <img className="w-[200px]" src={album?.photoUrl} alt="" />
        </div>
        <div>
          <p>{album?.description}</p>
          <h2 className="text-8xl font-medium">{album?.title}</h2>
        </div>
      </div>
      <div>Tracks</div>
    </div>
  );
};

export default AlbumPage;
