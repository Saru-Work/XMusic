import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import type { SongType } from "../types/song";
import { addLike, removeLike } from "../reducers/likesSlice";
import { showToast } from "../reducers/toastSlice";
import { api, errorMessage } from "./api";
import { isYouTubeResult } from "./youtube";

/** Like state + toggle for a song. `canLike` is false when logged out. */
export function useLike(song: SongType) {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.user.user);
  const likes = useSelector((s: RootState) => s.likes.songs);
  // A YouTube search result has no database id; it matches the saved copy of
  // the same video (which has no XMusic artist).
  const fromSearch = isYouTubeResult(song);
  const saved = likes.find((s) =>
    fromSearch
      ? s.youtubeId === song.youtubeId && !s.artist
      : s._id === song._id,
  );

  async function toggle() {
    try {
      if (saved) {
        dispatch(removeLike(saved._id)); // optimistic
        try {
          await api(`/likes/${saved._id}`, { method: "DELETE" });
        } catch (err) {
          dispatch(addLike(saved));
          throw err;
        }
        dispatch(showToast("Removed from Liked Songs"));
      } else {
        const data = await api<{ song: SongType }>("/likes", {
          method: "POST",
          json: fromSearch
            ? { videoId: song.youtubeId, duration: song.duration }
            : { songId: song._id },
        });
        dispatch(addLike(data.song));
        dispatch(showToast("Added to Liked Songs"));
      }
    } catch (err) {
      dispatch(showToast(errorMessage(err), "error"));
    }
  }

  return { liked: Boolean(saved), toggle, canLike: Boolean(user) };
}
