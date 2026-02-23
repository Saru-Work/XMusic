import { useEffect, useState } from "react";
import type { ArtistType } from "../types/artist";
import Artist from "./Artist";
import { Link } from "react-router-dom";

const Artists = () => {
  const [artists, setArtists] = useState<ArtistType[] | []>([]);
  useEffect(() => {
    async function fetchArtists() {
      const data = await fetch("http://localhost:3000/artists");
      const res = await data.json();
      console.log(res.artists);
      setArtists(res.artists);
    }
    fetchArtists();
  }, []);

  return (
    <div className="bg-linear-to-r from-[rgba(255,255,255,0.08)] to-[rgba(255,255,255,0.02)] p-4 rounded-[4px] w-full">
      <header className="flex justify-between items-center px-3.75 py-2">
        <h2 className="text-white font-medium">Top Artists</h2>
        <Link to="/artists" className="text-sm text-slate-400">
          See all
        </Link>
      </header>
      <div className="flex gap-3 overflow-x-auto">
        {artists.map((artist, i) => (
          <Artist artist={artist} key={i} />
        ))}
      </div>
    </div>
  );
};

export default Artists;
