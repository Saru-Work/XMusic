import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ArtistType } from "../types/artist";
import type { SongType } from "../types/song";
import Song from "../components/Song";
import type { AlbumType } from "./MyAlbums";
import Album from "../components/Album";

const ArtistPage = () => {
  const [artist, setArtist] = useState<ArtistType | null>();
  const [songs, setSongs] = useState<SongType[]>();
  const [albums, setAlbums] = useState<AlbumType[]>();
  const params = useParams();
  useEffect(() => {
    try {
      fetch(`http://localhost:3000/artist/${params.artistId}`)
        .then((data) => data.json())
        .then((data) => {
          setArtist(data.artist);
          setSongs(data.songs);
          setAlbums(data.albums);
        })
        .catch((err) => {
          console.log(err);
        });
    } catch (err) {
      console.log(err);
    }
  }, []);

  return (
    <div className="bg-[#211F27] h-[calc(100vh-92px)] overflow-auto p-10 rounded-[4px]">
      <div className="flex justify-between mb-10">
        <h1 className="text-white text-8xl">{artist?.title}</h1>
        <img className="w-50 rounded-[4px]" src={artist?.profileUrl} alt="" />
      </div>
      <div className="mb-10">
        <h2 className="text-white mb-5">Tracks</h2>
        <div>
          {songs?.map((song, i) => {
            return <Song isArtist={true} key={i} song={song} />;
          })}
        </div>
      </div>
      <div>
        <div className="text-white flex flex-wrap bg-[rgba(255,255,255,0.05)] ">
          {albums?.map((album, i) => {
            return (
              <Link key={i} to={`/album/${album._id}`}>
                <Album album={album} key={i} />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ArtistPage;
