import {
  Album,
  Disc3,
  Heart,
  History,
  Home,
  ListMusic,
  MicVocal,
  Music,
  Music2Icon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSelector } from "react-redux";
import { NavLink } from "react-router-dom";
import type { RootState } from "../store/store";

interface NavItem {
  name: string;
  to: string;
  icon: LucideIcon;
}

const browse: NavItem[] = [
  { name: "Home", to: "/", icon: Home },
  { name: "Albums", to: "/albums", icon: Album },
  { name: "Tracks", to: "/tracks", icon: Music },
  { name: "Genre", to: "/genre", icon: Music2Icon },
  { name: "Artists", to: "/artists", icon: MicVocal },
  { name: "Recently Played", to: "/recent", icon: History },
];

const NavSection = ({ title, items }: { title: string; items: NavItem[] }) => (
  <div className="flex items-center gap-1 md:block">
    <h2 className="hidden truncate px-3 font-bold text-white md:mb-3 md:block">{title}</h2>
    <ul className="flex gap-1 md:block md:space-y-1">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-2 whitespace-nowrap rounded-sm px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-white/20 font-medium text-white"
                  : "text-gray-300 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            <item.icon size={14} className="shrink-0" />
            <span className="truncate">{item.name}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  </div>
);

const Sidebar = () => {
  const { user } = useSelector((s: RootState) => s.user);
  const library: NavItem[] = [
    { name: "Liked Songs", to: "/liked", icon: Heart },
    { name: "Your Playlists", to: "/myPlaylists", icon: ListMusic },
    ...(user?.isArtist
      ? [{ name: "Your Albums", to: "/myAlbums", icon: Disc3 }]
      : []),
  ];
  return (
    <nav
      aria-label="Main"
      className="flex shrink-0 gap-4 overflow-x-auto rounded-[4px] bg-[rgba(44,40,40,0.4)] px-3 py-2 md:w-(--sidebar-w) md:flex-col md:gap-8 md:overflow-y-auto md:px-4 md:py-8"
    >
      <NavSection title="Browse Music" items={browse} />
      {user && <NavSection title="Library" items={library} />}
    </nav>
  );
};

export default Sidebar;
