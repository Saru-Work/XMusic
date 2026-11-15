import { useEffect, useState } from "react";
import "../App.css";
import banner from "../assets/banner.png";
import Artists from "../components/Artists";
import { API_URL } from "@/lib/api";
export interface Song {
  title: string;
  url: string;
}
function HomePage() {
  const [, setSongs] = useState<Song[] | []>([]);
  useEffect(() => {
    async function fetchSongs() {
      const data = await fetch(`${API_URL}/songs`);
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
        src={banner}
      />
      <Artists />
    </div>
  );
}

export default HomePage;
