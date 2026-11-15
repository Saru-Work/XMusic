import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { useEffect, useRef, useState } from "react";
import BecomeMemberModal from "./BecomeMemberModal";
import CreateAlbumForm from "./CreateAlbumForm";
import { Link, useNavigate } from "react-router-dom";
import Search from "./Search";
import { ChevronDown, CircleUserRound, Music } from "lucide-react";
import Modal from "./Modal";
import { removeUser, storeUser, type UserState } from "../reducers/userReducer";
import { removeSong } from "../reducers/songSlice";
import { api, errorMessage } from "@/lib/api";

const menuItem =
  "block w-full whitespace-nowrap rounded-sm px-3 py-2 text-left text-sm font-light hover:bg-white/10 cursor-pointer";

const Navbar = () => {
  const { user, initialized } = useSelector((s: RootState) => s.user);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [becomeArtistOpen, setBecomeArtistOpen] = useState(false);
  const [createAlbumOpen, setCreateAlbumOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLLIElement>(null);

  // Close the profile menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  async function logout() {
    setMenuOpen(false);
    try {
      await api("/logout", { method: "POST" });
    } catch {
      // Even if the request fails, the session is gone as far as the UI goes
    }
    dispatch(removeUser());
    dispatch(removeSong());
    navigate("/");
  }

  async function removeArtist() {
    setMenuOpen(false);
    const confirmed = window.confirm(
      "Remove your artist profile? Your albums and songs will no longer be visible to listeners.",
    );
    if (!confirmed) return;
    try {
      const data = await api<{ user: UserState }>("/artist/delete", {
        method: "PATCH",
      });
      dispatch(storeUser(data.user));
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 rounded-sm bg-[rgba(44,40,40,0.4)] px-4 text-white md:px-10">
      <BecomeMemberModal
        open={becomeArtistOpen}
        handleOpen={setBecomeArtistOpen}
      />
      <Modal
        title="Create album"
        open={createAlbumOpen}
        onClose={() => setCreateAlbumOpen(false)}
      >
        <CreateAlbumForm onClose={() => setCreateAlbumOpen(false)} />
      </Modal>
      <Modal
        title="Something went wrong"
        open={error !== null}
        onClose={() => setError(null)}
      >
        <p className="text-sm text-gray-300">{error}</p>
      </Modal>
      <Link to="/" className="flex shrink-0 items-center gap-2">
        <Music />
        <span className="font-bold">XMusic</span>
      </Link>
      <Search />
      <nav aria-label="Account" className="shrink-0">
        {/* Until the session check finishes we don't know which links to show */}
        <ul className={`flex items-center gap-2 ${initialized ? "" : "invisible"}`}>
          {user?.email ? (
            <li className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm hover:bg-white/10"
              >
                <CircleUserRound size={18} />
                <span className="hidden max-w-40 truncate sm:block">
                  {user.email}
                </span>
                <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <ul
                  role="menu"
                  className="absolute right-0 z-40 mt-2 min-w-44 rounded-[4px] bg-[#1F1F1F] p-2 shadow-2xl"
                >
                  {!user.isArtist ? (
                    <li role="none">
                      <button
                        role="menuitem"
                        className={menuItem}
                        onClick={() => {
                          setBecomeArtistOpen(true);
                          setMenuOpen(false);
                        }}
                      >
                        Become an artist
                      </button>
                    </li>
                  ) : (
                    <>
                      <li role="none">
                        <button
                          role="menuitem"
                          className={menuItem}
                          onClick={() => {
                            setCreateAlbumOpen(true);
                            setMenuOpen(false);
                          }}
                        >
                          Create album
                        </button>
                      </li>
                      <li role="none">
                        <Link
                          role="menuitem"
                          className={menuItem}
                          to="/myAlbums"
                          onClick={() => setMenuOpen(false)}
                        >
                          My albums
                        </Link>
                      </li>
                      <li role="none">
                        <Link
                          role="menuitem"
                          className={menuItem}
                          to="/upload"
                          onClick={() => setMenuOpen(false)}
                        >
                          Upload a single
                        </Link>
                      </li>
                      <li role="none">
                        <button
                          role="menuitem"
                          className={`${menuItem} text-red-300`}
                          onClick={removeArtist}
                        >
                          Remove artist profile
                        </button>
                      </li>
                    </>
                  )}
                  <li role="none" className="mt-1 border-t border-white/10 pt-1">
                    <button role="menuitem" className={menuItem} onClick={logout}>
                      Log out
                    </button>
                  </li>
                </ul>
              )}
            </li>
          ) : (
            <>
              <li>
                <Link
                  to="/login"
                  className="rounded-full px-3 py-1.5 text-sm hover:bg-white/10"
                >
                  Log in
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-200"
                >
                  Sign up
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
};

export default Navbar;
