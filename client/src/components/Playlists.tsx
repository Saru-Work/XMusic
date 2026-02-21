import { PenIcon } from "lucide-react";
import React, { useEffect, useReducer, useRef, useState } from "react";
import Playlist from "./Playlist";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { PlaylistType } from "../types/playlist";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
const Playlists = () => {
  const [playlists, setPlaylists] = useState<PlaylistType[] | []>([]);
  const { user } = useSelector((s: RootState) => s.user);
  const playlistsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    function scrollToEnd() {}
    scrollToEnd();
  }, [playlists]);
  useEffect(() => {
    async function fetchPlaylists() {
      const res = await fetch("http://localhost:3000/playlist/all", {
        method: "GET",
        credentials: "include",
      });
      const json = await res.json();
      console.log(json);
      setPlaylists(json.playlists);
    }
    fetchPlaylists();
  }, []);
  async function createPlaylist() {
    const res = await fetch("http://localhost:3000/playlist/create", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-type": "application/json",
      },
      body: JSON.stringify({
        title: `MyPlaylist#${playlists.length + 1}`,
      }),
    });
    const json = await res.json();
    setPlaylists([...playlists, json.playlist]);
    navigate(`/playlist/${json.playlist._id}`);
  }
  return (
    <div className="h-[calc(100vh-92px)] overflow-auto relative p-4">
      <header className="flex px-4 h-10 items-center justify-between mb-3 sticky z-10 bg-black top-0">
        <h2 className="text-slate-200 text-[0.9rem]">Your Playlists</h2>
        <PenIcon
          onClick={user ? createPlaylist : () => {}}
          color="white"
          size={15}
        />
      </header>
      {user && (
        <div
          ref={playlistsRef}
          className="flex flex-wrap justify-between gap-2 overflow-auto"
        >
          {playlists.map((a, i) => {
            return (
              <Link to={`/playlist/${a._id}`}>
                <Playlist playlist={a} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Playlists;
