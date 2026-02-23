import { useState, type CSSProperties, type FormEvent } from "react";
import type { AlbumType } from "../types/album";
import { MusicIcon } from "lucide-react";
import type { SongType } from "../types/song";
import { Oval } from "react-loader-spinner";
interface Props {
  isAlbum: boolean;
  onClose: () => void;
  album: AlbumType | null;
  songs: SongType[];
  setSongs: React.Dispatch<React.SetStateAction<SongType[]>>;
}
const UploadSong = ({ isAlbum, onClose, album, songs, setSongs }: Props) => {
  const [title, setTitle] = useState("");
  const [songFile, setSongFile] = useState<File | null>();
  const [isUploading, setIsUploading] = useState(false);
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData();
    if (isAlbum) {
      formData.append("title", title);
      if (songFile) {
        formData.append("audio", songFile);
      }
      if (album) {
        const res = await fetch(
          `http://localhost:3000/album/${album._id}/songs`,
          {
            method: "POST",
            credentials: "include",
            body: formData,
          },
        );
        const json = await res.json();
        setSongs([...songs, json.song]);
        setIsUploading(false);
        onClose();
      }
    }
  }
  return (
    <div className="bg-[#333333] p-5 shadow-2xl">
      <form onSubmit={handleSubmit} className="text-white">
        <div className="flex gap-4">
          <div>
            <label
              className="min-w-20 w-20 h-20 flex items-center justify-center rounded-[4px] border border-gray-500"
              htmlFor="song"
            >
              {songFile ? <div>{songFile.name}</div> : <MusicIcon />}
            </label>
            <input
              className="invisible w-0"
              type="file"
              id="song"
              name="song"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSongFile(e.target.files[0]);
                }
              }}
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="title" className="text-sm text-gray-300">
              Title
            </label>
            <input
              placeholder="Enakkena..."
              className="border border-gray-600 pl-4 py-1 text-sm"
              type="text"
              id="title"
              name="title"
              onChange={(e) => {
                setTitle(e.target.value);
              }}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-0.5 border border-black cursor-pointer text-[0.8rem] font-thin"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>

          <button
            className="px-3 py-0.5 border border-white cursor-pointer text-black text-[0.8rem] font-thin bg-white"
            type="submit"
          >
            {!isUploading ? (
              "Add"
            ) : (
              <Oval
                height={20}
                width={20}
                color="#4fa94d"
                wrapperStyle={{}}
                wrapperClass=""
                visible={true}
                ariaLabel="oval-loading"
                secondaryColor="#4fa94d"
                strokeWidth={2}
                strokeWidthSecondary={2}
              />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UploadSong;
