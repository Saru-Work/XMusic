import { Heart } from "lucide-react";
import type { SongType } from "../types/song";
import { useLike } from "@/lib/useLike";
import { cn } from "@/lib/utils";
import { iconButton } from "./States";

/** Heart toggle. Renders nothing for logged-out visitors. */
const LikeButton = ({
  song,
  size = 16,
  className,
}: {
  song: SongType;
  size?: number;
  className?: string;
}) => {
  const { liked, toggle, canLike } = useLike(song);
  if (!canLike) return null;
  const label = liked ? "Remove from Liked Songs" : "Add to Liked Songs";
  return (
    <button
      type="button"
      className={cn(iconButton, liked && "text-rose-400 hover:text-rose-300", className)}
      onClick={toggle}
      aria-pressed={liked}
      aria-label={`${label}: ${song.title}`}
      title={label}
    >
      <Heart size={size} fill={liked ? "currentColor" : "none"} />
    </button>
  );
};

export default LikeButton;
