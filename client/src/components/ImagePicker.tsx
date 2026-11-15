import { ImagePlus, Pencil } from "lucide-react";
import { useId, useState } from "react";

/** Square image chooser with a preview. `existingUrl` is shown until a new file is picked. */
const ImagePicker = ({
  onChange,
  existingUrl,
  label = "Cover image",
}: {
  onChange: (file: File) => void;
  existingUrl?: string | null;
  label?: string;
}) => {
  const id = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const shown = previewUrl ?? existingUrl;
  return (
    <div className="shrink-0">
      <label
        htmlFor={id}
        title={shown ? "Change image" : "Choose an image"}
        className="group relative flex h-36 w-36 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-sm border border-dashed border-white/30 text-xs text-gray-400 hover:border-white/60 hover:text-white focus-within:ring-2 focus-within:ring-white/40"
      >
        {shown ? (
          <>
            <img className="h-full w-full object-cover" src={shown} alt="" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Pencil size={20} className="text-white" />
            </span>
          </>
        ) : (
          <>
            <ImagePlus size={24} />
            {label}
          </>
        )}
        <input
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={label}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(URL.createObjectURL(file));
            onChange(file);
          }}
        />
      </label>
    </div>
  );
};

export default ImagePicker;
