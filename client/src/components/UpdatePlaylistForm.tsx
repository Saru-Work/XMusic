import React, { useState, type FormEvent } from "react";
import type { PlaylistType } from "../types/playlist";
import { Music, Pencil, X } from "lucide-react";
interface Props {
  playlist: PlaylistType | null | undefined;
  onClose: () => void;
  setPlaylist: React.Dispatch<
    React.SetStateAction<PlaylistType | null | undefined>
  >;
}
interface FormInfoType {
  title: string;
  description: string;
}
const UpdatePlaylistForm = ({ playlist, onClose, setPlaylist }: Props) => {
  const [hoveredPen, setHoveredPen] = useState(false);
  const [imgFile, setImgFile] = useState<File>();
  const [formInfo, setFormInfo] = useState<FormInfoType>({
    title: "",
    description: "",
  });
  async function updatePlaylist(e: FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.append("title", formInfo.title);
    formData.append("description", formInfo.description);
    if (imgFile) {
      formData.append("image", imgFile);
    }
    const res = await fetch(
      `http://localhost:3000/playlist/edit/${playlist?._id}`,
      {
        method: "PUT",
        credentials: "include",
        body: formData,
      },
    );
    const json = await res.json();
    setPlaylist(json.playlist);
    onClose();
  }
  return (
    <div className="max-w-lg w-full bg-[#A1BC98] shadow-xl p-8 relative">
      <h2 className="mb-4 text-gray-800">Edit Playlist</h2>

      <form onSubmit={updatePlaylist} className="space-y-1">
        <div className="flex gap-2">
          <div className="flex flex-col">
            <label
              htmlFor="cover_image"
              className="w-38 h-38 flex items-center justify-center border border-gray-300 cursor-pointer"
              onMouseEnter={() => {
                setHoveredPen(true);
              }}
              onMouseLeave={() => {
                setHoveredPen(false);
              }}
            >
              {imgFile ? (
                <img
                  className="w-38 h-38 object-cover"
                  src={URL.createObjectURL(imgFile)}
                />
              ) : !hoveredPen ? (
                <Music />
              ) : (
                <Pencil />
              )}
            </label>
            <input
              type="file"
              name="cover_image"
              id="cover_image"
              className="invisible w-0"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setImgFile(e.target.files[0]);
                }
              }}
            />
          </div>
          <div>
            <div className="flex flex-col gap-2 relative mb-4">
              <label
                htmlFor="title"
                className="text-sm font-medium text-gray-700 absolute bg-[#A1BC98] left-2 -top-1/2 translate-y-3.5 text-[0.7rem]"
              >
                Title
              </label>
              <input
                type="text"
                name="title"
                id="title"
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                placeholder="Enter playlist title"
                onChange={(e) => {
                  setFormInfo({ ...formInfo, title: e.target.value });
                }}
              />
            </div>

            <div className="flex flex-col gap-2 relative">
              <label
                htmlFor="description"
                className="text-sm font-medium text-gray-700 absolute bg-[#A1BC98] left-2 -top-2 text-[0.7rem]"
              >
                Description
              </label>
              <textarea
                name="description"
                id="description"
                rows={4}
                defaultValue={"This is so good"}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition resize-none"
                placeholder="Write something about this playlist..."
                onChange={(e) => {
                  setFormInfo({ ...formInfo, description: e.target.value });
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1 border text-sm border-gray-300 text-gray-700 hover:bg-gray-100 transition"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="px-5 py-1 text-sm bg-black text-white hover:bg-gray-800 transition"
          >
            Update
          </button>
        </div>
      </form>
      <button className="absolute top-3 right-3">
        <X size={18} onClick={onClose} overlineThickness={1} />
      </button>
    </div>
  );
};

export default UpdatePlaylistForm;
