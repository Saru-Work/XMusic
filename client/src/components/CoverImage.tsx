import { Music, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Square cover art with an icon fallback when there is no image or it fails to load */
const CoverImage = ({
  src,
  alt = "",
  className,
  icon: Icon = Music,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  icon?: LucideIcon;
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src && failedSrc !== src;
  return (
    <div
      className={cn(
        "aspect-square shrink-0 overflow-hidden rounded-[4px] bg-white/10 flex items-center justify-center text-gray-400",
        className,
      )}
    >
      {showImage ? (
        <img
          className="h-full w-full object-cover"
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Icon className="h-2/5 w-2/5" strokeWidth={1.25} aria-hidden="true" />
      )}
    </div>
  );
};

export default CoverImage;
