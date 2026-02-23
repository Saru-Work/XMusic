import { useEffect, useState } from "react";
import type { SongType } from "../types/song";
import {
  PlusCircleIcon,
  PlusIcon,
  SearchIcon,
  SquareCheck,
} from "lucide-react";
import type { PlaylistType } from "../types/playlist";

const AddSongsToPlaylistForm = ({
  playlist,
  onClose,
  setSongsToPlaylist,
  songsPlaylist,
}: {
  playlist: PlaylistType | null | undefined;
  onClose: () => void;
  setSongsToPlaylist: React.Dispatch<React.SetStateAction<SongType[]>>;
  songsPlaylist: SongType[];
}) => {
  const [songs, setSongs] = useState<SongType[]>();
  const [playlistSongs, setPlaylistSongs] = useState<SongType[] | undefined>(
    playlist?.songs,
  );
  const [input, setInput] = useState("");
  const [filteredSongs, setFilteredSongs] = useState<SongType[]>();
  useEffect(() => {
    async function getSongs() {
      const res = await fetch("http://localhost:3000/songs");
      const json = await res.json();
      setSongs(json.songs);
    }
    getSongs();
  }, []);
  async function addSong(song: SongType) {
    if (!playlist) return;
    const res = await fetch(
      `http://localhost:3000/playlist/${playlist._id}/song/${song._id}`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-type": "application/json",
        },
      },
    );
    setSongsToPlaylist([...songsPlaylist, song]);
  }
  return (
    <div className="text-white bg-[#222222] min-h-100 min-w-100 p-10 pb-15 relative overflow-auto">
      <h1 className="mb-1">Add Songs</h1>
      <h2 className="text-sm font-thin mb-3">
        Search and add songs to the playlist
      </h2>
      <div className="flex gap-2 my-4">
        <input
          className="bg-black w-full pl-4 text-[0.8rem] py-1 font-thin outline-0"
          type="text"
          onChange={(e) => {
            setInput(e.target.value);
            if (songs) {
              const filt = songs.filter((song) => {
                if (
                  song.title
                    .toLocaleLowerCase()
                    .includes(e.target.value.toLowerCase()) &&
                  song.artist
                ) {
                  return song;
                } else {
                  return null;
                }
              });
              if (filt.length > 0) {
                setFilteredSongs(filt);
              } else {
                setFilteredSongs([]);
              }
            }
            console.log(filteredSongs, input);
          }}
        />
        <button>
          <SearchIcon />
        </button>
      </div>
      <div>
        {filteredSongs?.map((song, i) => {
          const isInPlaylist = new Set(playlistSongs?.map((s) => s._id)).has(
            song._id,
          );
          return (
            <div
              key={i}
              className="flex items-center justify-between py-1 bg-[rgba(255,255,255,0.05)] p-1 mb-1"
            >
              <div className="text-sm font-thin">{song.title}</div>
              <div className="flex">
                <div className="text-sm font-thin w-10"> {song.duration}</div>
                <button
                  className="cursor-pointer"
                  onClick={() => {
                    addSong(song);
                  }}
                >
                  {!isInPlaylist ? (
                    <PlusCircleIcon size={15} />
                  ) : (
                    <SquareCheck size={15} />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button
        className="absolute bottom-4 right-4 border text-sm px-4 py-1 cursor-pointer"
        onClick={() => {
          console.log(songs);
          onClose();
        }}
      >
        Done
      </button>
    </div>
  );
};

export default AddSongsToPlaylistForm;
