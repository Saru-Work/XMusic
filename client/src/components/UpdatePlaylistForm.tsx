import { useId, useState, type FormEvent } from "react";
import type { PlaylistType } from "../types/playlist";
import { api, errorMessage } from "@/lib/api";
import ImagePicker from "./ImagePicker";
import {
  FormError,
  Spinner,
  primaryButton,
  secondaryButton,
  textInput,
} from "./States";

interface Props {
  playlist: PlaylistType;
  onClose: () => void;
  onSaved: (changes: Pick<PlaylistType, "title" | "description" | "coverImage">) => void;
}

const UpdatePlaylistForm = ({ playlist, onClose, onSaved }: Props) => {
  const id = useId();
  const [imgFile, setImgFile] = useState<File>();
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function updatePlaylist(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the playlist a title.");
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    if (imgFile) formData.append("image", imgFile);
    setError(null);
    setSaving(true);
    try {
      const data = await api<{ playlist: PlaylistType }>(
        `/playlist/edit/${playlist._id}`,
        { method: "PUT", form: formData },
      );
      onSaved({
        title: data.playlist.title,
        description: data.playlist.description,
        coverImage: data.playlist.coverImage,
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={updatePlaylist} className="space-y-4" noValidate>
      <div className="flex flex-col gap-4 sm:flex-row">
        <ImagePicker onChange={setImgFile} existingUrl={playlist.coverImage} />
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-title`} className="text-xs text-gray-400">
              Title
            </label>
            <input
              id={`${id}-title`}
              type="text"
              className={textInput}
              placeholder="Playlist title"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-description`} className="text-xs text-gray-400">
              Description <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              id={`${id}-description`}
              rows={3}
              className={`${textInput} resize-none`}
              placeholder="Write something about this playlist…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      </div>
      <FormError message={error} />
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className={secondaryButton}>
          Cancel
        </button>
        <button type="submit" className={primaryButton} disabled={saving}>
          {saving && <Spinner size={14} />}
          Save
        </button>
      </div>
    </form>
  );
};

export default UpdatePlaylistForm;
