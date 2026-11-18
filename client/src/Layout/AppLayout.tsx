import { useEffect, useState, type CSSProperties } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../store/store";
import {
  removeUser,
  storeUser,
  type UserState,
} from "../reducers/userReducer";
import Sidebar from "../components/Sidebar";
import Player from "../components/Player";
import ResizeHandle from "../components/ResizeHandle";
import Toaster from "../components/Toaster";
import { setLikes } from "../reducers/likesSlice";
import type { SongType } from "../types/song";
import { api } from "@/lib/api";
import { startRemote } from "@/lib/remote";
import { cn } from "@/lib/utils";

const LAYOUT_KEY = "xmusic:layout";
// Section widths in px. The page content takes whatever is left.
const SIDEBAR = { min: 170, max: 400, initial: 208 };
const PLAYER = { min: 260, max: 640, initial: 320 };
/** Never let the side sections squeeze the page content below this */
const MIN_CONTENT = 320;

function storedLayout() {
  const layout = { sidebar: SIDEBAR.initial, player: PLAYER.initial };
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "{}");
    if (saved.sidebar >= SIDEBAR.min && saved.sidebar <= SIDEBAR.max)
      layout.sidebar = saved.sidebar;
    if (saved.player >= PLAYER.min && saved.player <= PLAYER.max)
      layout.player = saved.player;
  } catch {
    // keep defaults
  }
  return layout;
}

function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}

const AppLayout = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { song } = useSelector((s: RootState) => s.song);
  const userId = useSelector((s: RootState) => s.user.user?._id);
  const [layout, setLayout] = useState(storedLayout);
  // The "now playing" section; the Player renders the cover/video and queue into it
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const { pathname } = useLocation();
  // On the Now Playing page that section takes over the page area
  const playingPage = pathname === "/playing" && song !== null;
  const hasVideo = song?.source === "youtube";
  const windowWidth = useWindowWidth();

  useEffect(() => {
    api<UserState>("/profile")
      .then((user) => dispatch(storeUser(user)))
      .catch(() => dispatch(removeUser()));
  }, [dispatch]);

  // Liked songs belong to the account: load them whenever someone logs in
  useEffect(() => {
    if (!userId) return;
    api<{ songs: SongType[] }>("/likes")
      .then((data) => dispatch(setLikes(data.songs)))
      .catch(() => {});
  }, [userId, dispatch]);

  // Let the server (and ChatGPT, later) control playback in this tab
  useEffect(() => {
    if (!userId) return;
    return startRemote();
  }, [userId]);

  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      // not persisted
    }
  }, [layout]);

  // How wide each side section may get in this window, so the page content
  // always keeps MIN_CONTENT. (24px outer padding + two 12px dividers.)
  const room = windowWidth - 48 - MIN_CONTENT;
  const playerSpace = song ? layout.player : 0;
  const sidebarMax = Math.max(
    SIDEBAR.min,
    Math.min(SIDEBAR.max, room - Math.min(playerSpace, PLAYER.min)),
  );
  const sidebar = Math.min(layout.sidebar, sidebarMax);
  const playerMax = Math.max(PLAYER.min, Math.min(PLAYER.max, room - sidebar));
  const player = Math.min(layout.player, playerMax);

  return (
    <div
      className="flex h-dvh flex-col gap-3 overflow-hidden bg-black p-3"
      style={
        {
          "--sidebar-w": `${sidebar}px`,
          "--player-w": `${player}px`,
        } as CSSProperties
      }
    >
      <Navbar />
      {/* Three sections: sidebar | page | now playing. Side by side on large
          screens (with draggable dividers), stacked on smaller ones. */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-0",
          // The Now Playing page sits beside the sidebar from md up
          playingPage && "md:flex-row md:gap-0",
        )}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col gap-3 md:flex-row md:gap-0",
            playingPage ? "shrink-0" : "flex-1",
          )}
        >
          <Sidebar />
          <ResizeHandle
            label="Resize sidebar"
            className="hidden md:flex"
            value={sidebar}
            min={SIDEBAR.min}
            max={sidebarMax}
            defaultValue={SIDEBAR.initial}
            direction={1}
            onChange={(width) => setLayout((l) => ({ ...l, sidebar: width }))}
          />
          <main
            className={cn(
              "min-h-0 min-w-0 flex-1 overflow-auto rounded-[4px] bg-[rgba(44,40,40,0.4)]",
              playingPage && "hidden",
            )}
          >
            <Outlet />
          </main>
        </div>
        {song && (
          <>
            <ResizeHandle
              label="Resize now playing"
              className={playingPage ? "hidden" : "hidden lg:flex"}
              value={player}
              min={PLAYER.min}
              max={playerMax}
              defaultValue={PLAYER.initial}
              direction={-1}
              onChange={(width) => setLayout((l) => ({ ...l, player: width }))}
            />
            <section
              ref={setPanel}
              aria-label="Now playing"
              className={cn(
                "overflow-y-auto rounded-[4px]",
                playingPage
                  ? "min-h-0 min-w-0 flex-1"
                  : cn(
                      "shrink-0 lg:block lg:w-(--player-w)",
                      // Below lg only a video is shown here (it must stay visible)
                      !hasVideo && "hidden",
                    ),
              )}
            />
          </>
        )}
      </div>
      {song && <Player song={song} panel={panel} page={playingPage} />}
      <Toaster />
    </div>
  );
};

export default AppLayout;
