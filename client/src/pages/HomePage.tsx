import { useEffect, useState } from "react";
import "../App.css";
import Player from "../components/Player";
import Artists from "../components/Artists";
export interface Song {
  title: string;
  url: string;
}
function HomePage() {
  const [songs, setSongs] = useState<Song[] | []>([]);
  const [open, setOpen] = useState(false);
  const [showPlayer, setShowPlayer] = useState<boolean>(false);
  const [currentSong, setCurrentSong] = useState<Song | undefined>();
  useEffect(() => {
    async function fetchSongs() {
      const data = await fetch("http://localhost:3000/songs");
      const songs = await data.json();
      console.log(songs);
      setSongs(songs);
    }
    fetchSongs();
  }, []);

  return (
    <div className="h-[calc(100vh-92px)] overflow-auto p-5 bg-linear-to-b from-[rgba(44,40,40,0.4)] to-[rgba(27,26,26,0.4)]">
      <img
        className="rounded-t-[4px]"
        src="https://res.cloudinary.com/dffbsxhgc/image/upload/v1771665809/banner1_khxbhg.png"
      />
      <Artists />
      <div>
        {songs.map((song, i) => (
          <div
            onClick={() => {
              setShowPlayer(true);
              setCurrentSong(song);
            }}
            key={i}
          >
            {song.title}
          </div>
        ))}
        {showPlayer && <Player song={currentSong} />}
      </div>
    </div>
  );
}

export default HomePage;
