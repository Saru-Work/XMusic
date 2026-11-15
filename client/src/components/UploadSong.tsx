import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { MonitorPlay, MusicIcon } from "lucide-react";
import type { SongType } from "../types/song";
import { api, errorMessage } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { parseYouTubeId } from "@/lib/youtube";
import YouTubeEngine from "./YouTubeEngine";
import {
  FormError,
  Spinner,
  primaryButton,
  secondaryButton,
  textInput,
} from "./States";

interface Props {
  /** Endpoint an audio file is posted to, e.g. `/album/<id>/songs` */
  endpoint: string;
  /** Form field the file endpoint expects the title in */
  titleField?: string;
  /** Endpoint a YouTube link is posted to. Omit to only allow file uploads. */
  youtubeEndpoint?: string;
  onUploaded: (song: SongType) => void;
  onCancel?: () => void;
}

type Source = "file" | "youtube";

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
  youtubeEndpoint,
  onUploaded,
  onCancel,
}: Props) => {
  const id = useId();
  const [source, setSource] = useState<Source>("file");
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [songFile, setSongFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  // Length of the previewed video, remembered together with the video it belongs to
  const [preview, setPreview] = useState<{ id: string; duration: number }>();
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoId = parseYouTubeId(link);
  const duration = preview?.id === videoId ? preview.duration : 0;
  // Readable from the submit handler while it waits for the preview to load
  const previewState = useRef({ duration, failed: false });
  useEffect(() => {
    previewState.current = { duration, failed: previewError !== null };
  });

  /**
   * The preview player may report the video's length; give it a moment.
   * If it doesn't, the length is saved the first time the song is played.
   */
  async function waitForDuration() {
    for (let i = 0; i < 6; i++) {
      const { duration, failed } = previewState.current;
      if (duration || failed) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return previewState.current.duration;
  }

  function reset() {
    setTitle("");
    setTitleEdited(false);
    setSongFile(null);
    setLink("");
    setPreview(undefined);
    setPreviewError(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    let send: () => Promise<{ song: SongType }>;
    if (source === "youtube") {
      if (!videoId) return setError("Paste a YouTube or YouTube Music link.");
      if (previewError) return setError(previewError);
      send = async () =>
        api(youtubeEndpoint!, {
          method: "POST",
          json: {
            url: link.trim(),
            title: title.trim(),
            duration: await waitForDuration(),
          },
        });
    } else {
      if (!songFile) return setError("Choose an audio file to upload.");
      if (!title.trim()) return setError("Give the song a title.");
      const formData = new FormData();
      formData.append(titleField, title);
      formData.append("audio", songFile);
      send = () => api(endpoint, { method: "POST", form: formData });
    }
    setError(null);
    setIsUploading(true);
    try {
      const data = await send();
      reset();
      form.reset();
      onUploaded(data.song);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsUploading(false);
    }
  }

  const tab = (value: Source, label: string, Icon: typeof MusicIcon) => (
    <button
      type="button"
      role="tab"
      aria-selected={source === value}
      onClick={() => {
        setSource(value);
        setError(null);
      }}
      className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
        source === value
          ? "bg-white text-black"
          : "text-gray-300 hover:bg-white/10"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-white" noValidate>
      {youtubeEndpoint && (
        <div
          role="tablist"
          aria-label="Song source"
          className="flex gap-1 rounded-full bg-white/5 p-1"
        >
          {tab("file", "Audio file", MusicIcon)}
          {tab("youtube", "YouTube link", MonitorPlay)}
        </div>
      )}
      {source === "file" ? (
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
                if (!titleEdited) setTitle(titleFromFile(file.name));
              }}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-link`} className="text-xs text-gray-400">
              YouTube or YouTube Music link
            </label>
            <input
              id={`${id}-link`}
              type="url"
              inputMode="url"
              className={textInput}
              placeholder="https://music.youtube.com/watch?v=…"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setPreviewError(null);
                setError(null);
              }}
            />
          </div>
          {link.trim() && !videoId && (
            <p className="text-xs text-amber-300">
              That doesn't look like a YouTube video link.
            </p>
          )}
          {videoId && (
            <>
              <YouTubeEngine
                key={videoId}
                videoId={videoId}
                playing={false}
                className="aspect-video w-full"
                onTitle={(found) => {
                  if (!titleEdited) setTitle(found);
                }}
                onDuration={(seconds) => {
                  if (preview?.id !== videoId || preview.duration !== seconds)
                    setPreview({ id: videoId, duration: seconds });
                }}
                onError={setPreviewError}
              />
              {previewError ? (
                <FormError message={previewError} />
              ) : (
                <p className="text-xs text-gray-400">
                  {duration
                    ? `Length ${formatDuration(duration)}. `
                    : ""}
                  The song will play through this YouTube player.
                </p>
              )}
            </>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-title`} className="text-xs text-gray-400">
          Title
          {source === "youtube" && (
            <span className="text-gray-500">
              {" "}
              (filled in from the video)
            </span>
          )}
        </label>
        <input
          id={`${id}-title`}
          placeholder="Song title"
          className={textInput}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleEdited(e.target.value.trim() !== "");
          }}
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
          {source === "youtube"
            ? isUploading
              ? "Adding…"
              : "Add song"
            : isUploading
              ? "Uploading…"
              : "Upload"}
        </button>
      </div>
    </form>
  );
};

export default UploadSong;
