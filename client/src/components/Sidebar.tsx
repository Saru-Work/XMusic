import { Album, Home, MicVocal, Music, Music2Icon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
const nav1 = [
  { name: "Home", to: "/", icon: Home },
  { name: "Albums", to: "/albums", icon: Album },
  { name: "Tracks", to: "/tracks", icon: Music },
  { name: "Genre", to: "/genre", icon: Music2Icon },
  { name: "Artists", to: "/artists", icon: MicVocal },
];
const nav2 = [
  { name: "Recently Played", to: "/recentlyPlayes" },
  { name: "Your Playlists", to: "/myPlaylists" },
  { name: "Favorite Tracks", to: "/favoriteTracks" },
];
const Sidebar = () => {
  const [pathname, setPathname] = useState(window.location.pathname);
  return (
    <div className="h-[calc(100vh-92px)] bg-[rgba(44,40,40,0.4)] flex-1 min-w-25 rounded-[4px] flex flex-col gap-2 px-10 py-10">
      <div className="mb-5">
        <h2 className="text-white font-bold mb-3">Browse Music</h2>
        <ul>
          {nav1.map((item, i) => {
            const Icon = item.icon as LucideIcon;
            return (
              <li
                onClick={() => {
                  setPathname(location.pathname);
                }}
                className="py-1 text-gray-300"
                key={i}
              >
                <Link
                  className={`text-sm w-32 px-3 flex items-center gap-2 hover:bg-linear-to-r hover:from-[rgba(255,255,255,0.2)] hover:to-[rgba(255,255,255,0.05)] transition-all p-1 rounded-sm 
                    ${pathname === item.to && " bg-linear-to-r from-[rgba(255,255,255,0.4)] to-[rgba(255,255,255,0.6)]"}
                     hover:scale-105`}
                  to={item.to}
                >
                  <Icon size={14} />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="">
        <h2 className="text-white font-bold mb-3">Library</h2>
        <ul>
          {nav2.map((item, i) => {
            return (
              <li
                onClick={() => {
                  setPathname(location.pathname);
                }}
                className="py-1 text-gray-300"
                key={i}
              >
                <Link
                  className={`text-sm flex px-3 rounded-sm items-center p-1 w-32 hover:bg-linear-to-r hover:from-[rgba(255,255,255,0.2)] hover:to-[rgba(255,255,255,0.05)] transition-all 
                    ${pathname === item.to && " bg-linear-to-r from-[rgba(255,255,255,0.4)] to-[rgba(255,255,255,0.6)]"}
                    hover:scale-105`}
                  to={item.to}
                >
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
