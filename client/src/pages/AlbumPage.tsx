import React, { useEffect, useState } from "react";
import type { AlbumType } from "../types/album";
import { useParams } from "react-router-dom";

import { PlusCircle, PlusIcon } from "lucide-react";
import Modal from "../components/Modal";
import UploadSong from "../components/UploadSong";
import type { SongType } from "../types/song";
import Song from "../components/Song";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";

const AlbumPage = () => {
  const { user } = useSelector((s: RootState) => s.user);
  const [album, setAlbum] = useState<AlbumType | null>(null);
  const [songs, setSongs] = useState<SongType[]>([]);
  const [openSongUpload, setOpenSongUpload] = useState(false);
  const img = album
    ? album?.photoUrl
    : "https://res.cloudinary.com/dffbsxhgc/image/upload/v1771665809/banner1_khxbhg.png";
  const params = useParams();
  useEffect(() => {
    async function fetchAlbum() {
      const res = await fetch(`http://localhost:3000/album/${params.albumId}`);
      const json = await res.json();
      setAlbum(json.album);
      setSongs(json.songs);
    }
    fetchAlbum();
  }, []);

  return (
    <div
      className={`h-[calc(100vh-92px)] overflow-auto rounded-[4px] bg-[#222222] to-black`}
      style={{
        background: `linear-gradient(${album?.colors[2].hex}, black)`,
      }}
    >
      <Modal
        open={openSongUpload}
        onClose={() => {
          setOpenSongUpload(false);
        }}
      >
        <UploadSong
          album={album}
          isAlbum={true}
          onClose={() => {
            setOpenSongUpload(false);
          }}
          setSongs={setSongs}
          songs={songs}
        />
      </Modal>
      <div
        style={{
          backgroundColor: album?.colors[2].hex,
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
      <div className="p-5">
        <header className="flex justify-between mb-3">
          <h2 className="text-white">Tracks</h2>
          <button
            onClick={() => {
              setOpenSongUpload(true);
            }}
          >
            {user && <PlusCircle color="white" />}
          </button>
        </header>
        <div>
          {songs?.map((song, i) => {
            return <Song isArtist={false} key={i} song={song} />;
          })}
        </div>
      </div>
    </div>
  );
};

export default AlbumPage;
