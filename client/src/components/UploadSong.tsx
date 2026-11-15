import { useId, useState, type FormEvent } from "react";
import { MusicIcon } from "lucide-react";
import type { SongType } from "../types/song";
import { api, errorMessage } from "@/lib/api";
import {
  FormError,
  Spinner,
  primaryButton,
  secondaryButton,
  textInput,
} from "./States";

interface Props {
  /** Endpoint the song is posted to, e.g. `/album/<id>/songs` */
  endpoint: string;
  /** Form field the endpoint expects the title in */
  titleField?: string;
  onUploaded: (song: SongType) => void;
  onCancel?: () => void;
}

/** "my_song-01.mp3" -> "my song 01" */
function titleFromFile(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

const UploadSong = ({
  endpoint,
  titleField = "title",
  onUploaded,
  onCancel,
}: Props) => {
  const id = useId();
  const [title, setTitle] = useState("");
  const [songFile, setSongFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!songFile) return setError("Choose an audio file to upload.");
    if (!title.trim()) return setError("Give the song a title.");
    const form = e.currentTarget;
    const formData = new FormData();
    formData.append(titleField, title);
    formData.append("audio", songFile);
    setError(null);
    setIsUploading(true);
    try {
      const data = await api<{ song: SongType }>(endpoint, {
        method: "POST",
        form: formData,
      });
      setTitle("");
      setSongFile(null);
      form.reset();
      onUploaded(data.song);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-white" noValidate>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-gray-400">Audio file</span>
        <label
          htmlFor={`${id}-file`}
          className="flex cursor-pointer items-center gap-3 rounded-sm border border-dashed border-white/30 px-3 py-3 text-sm text-gray-300 hover:border-white/60 focus-within:ring-2 focus-within:ring-white/40"
        >
          <MusicIcon size={18} className="shrink-0" />
          <span className="truncate">
            {songFile ? songFile.name : "Choose an audio file (MP3, WAV, …)"}
          </span>
          <input
            id={`${id}-file`}
            className="sr-only"
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setSongFile(file);
              if (!title.trim()) setTitle(titleFromFile(file.name));
            }}
          />
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-title`} className="text-xs text-gray-400">
          Title
        </label>
        <input
          id={`${id}-title`}
          placeholder="Song title"
          className={textInput}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <FormError message={error} />
      <div className="flex justify-end gap-3">
        {onCancel && (
          <button className={secondaryButton} onClick={onCancel} type="button">
            Cancel
          </button>
        )}
        <button className={primaryButton} type="submit" disabled={isUploading}>
          {isUploading && <Spinner size={14} />}
          {isUploading ? "Uploading…" : "Upload"}
        </button>
      </div>
    </form>
  );
};

export default UploadSong;
