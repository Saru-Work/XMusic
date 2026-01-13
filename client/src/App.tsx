import { useEffect, useState } from "react";
import "./App.css";
import Player from "./components/Player";
export interface Song {
  name: string;
  link: string;
}
function App() {
  const [songs, setSongs] = useState<Song[] | []>([]);
  const [showPlayer, setShowPlayer] = useState<boolean>(false);
  const [currentSong, setCurrentSong] = useState<Song | undefined>();
  useEffect(() => {
    async function fetchSongs() {
      const data = await fetch("http://localhost:3000/songs");
      const songs = await data.json();
      setSongs(songs);
    }
    fetchSongs();
  });
  return (
    <div>
      {songs.map((song, i) => (
        <div
          onClick={() => {
            setShowPlayer(true);
            setCurrentSong(song);
          }}
          key={i}
        >
          {song.name}
        </div>
      ))}
      {showPlayer && <Player song={currentSong} />}
    </div>
  );
}

export default App;
