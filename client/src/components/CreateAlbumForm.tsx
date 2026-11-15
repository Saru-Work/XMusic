import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage } from "@/lib/api";
import type { AlbumType } from "../types/album";
import ImagePicker from "./ImagePicker";
import {
  FormError,
  Spinner,
  primaryButton,
  secondaryButton,
  textInput,
} from "./States";

interface Props {
  onClose: () => void;
}

const CreateAlbumForm = ({ onClose }: Props) => {
  const id = useId();
  const navigate = useNavigate();
  const [imgFile, setImgFile] = useState<File>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give the album a title.");
    if (!imgFile) return setError("Choose a cover image for the album.");
    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("image", imgFile);
    setError(null);
    setSaving(true);
    try {
      const data = await api<{ album: AlbumType }>("/album/create", {
        method: "POST",
        form: formData,
      });
      onClose();
      // Take the artist straight to the new album so they can add tracks
      navigate(`/album/${data.album._id}`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="flex flex-col gap-4 sm:flex-row">
        <ImagePicker onChange={setImgFile} />
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-title`} className="text-xs text-gray-400">
              Title
            </label>
            <input
              id={`${id}-title`}
              type="text"
              className={textInput}
              placeholder="Album title"
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
              placeholder="Write something about this album…"
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
          Create album
        </button>
      </div>
    </form>
  );
};

export default CreateAlbumForm;
