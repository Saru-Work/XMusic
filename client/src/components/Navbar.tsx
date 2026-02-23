import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../store/store";
import { useEffect, useRef, useState } from "react";
import BecomeMemberModal from "./BecomeMemberModal";
import CreateAlbumForm from "./CreateAlbumForm";
import { Link } from "react-router-dom";
import Search from "./Search";
import { Music } from "lucide-react";
import Modal from "./Modal";
import { removeUser } from "../reducers/userReducer";

const Navbar = () => {
  const { user, initialized } = useSelector((s: RootState) => s.user);
  const [openPop, setOpenPop] = useState(false);
  const [open, setOpen] = useState(false);
  const [openCreateAlbum, setOpenCreateAlbum] = useState(false);
  const triggerRef = useRef(null);
  const popUpRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function openPopUp() {
      window.addEventListener("click", (e) => {
        const target = e.target as Node;
        if (!popUpRef.current) {
          return;
        }
        if (
          triggerRef.current !== target &&
          !popUpRef.current.contains(target)
        ) {
          setOpenPop(false);
        }
      });
    }
    openPopUp();
  }, []);
  if (!initialized) return null;
  return (
    <header className="flex bg-[rgba(44,40,40,0.4)] justify-between items-center mb-3 text-white px-10 py-3 h-16 rounded-sm">
      <BecomeMemberModal open={open} handleOpen={setOpen} />
      <Modal
        open={openCreateAlbum}
        onClose={() => {
          setOpenCreateAlbum(false);
        }}
      >
        <CreateAlbumForm
          onClose={() => {
            setOpenCreateAlbum(false);
          }}
        />
      </Modal>
      <Link to="/" className="flex gap-2 items-center">
        <Music />
        <span className="font-bold">XMusic</span>
      </Link>
      <Search />
      <nav>
        <ul className="flex gap-2">
          {user?.email ? (
            <li className="relative">
              <div
                onClick={() => {
                  setOpenPop(true);
                }}
                ref={triggerRef}
                className="text-sm"
              >
                Profile
              </div>
              {openPop && (
                <Popdown
                  setOpenCreateAlbum={setOpenCreateAlbum}
                  setOpen={setOpen}
                  ref={popUpRef}
                  setOpenPop={setOpenPop}
                />
              )}
            </li>
          ) : (
            <>
              <li>
                <Link to="/login" className="text-sm">
                  Login
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-sm">
                  Register
                </Link>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
};

const Popdown = ({
  ref,
  setOpen,
  setOpenCreateAlbum,
  setOpenPop,
}: {
  ref: React.RefObject<HTMLDivElement | null>;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenCreateAlbum: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenPop: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const { user } = useSelector((s: RootState) => s.user);
  const dispatch = useDispatch<AppDispatch>();

  return (
    <div
      className="text-white bg-[#1F1F1F] px-5 py-3 rounded-[4px] absolute right-0 transition-all shadow-2xl"
      ref={ref}
    >
      <ul>
        <li
          onClick={async () => {
            await fetch("http://localhost:3000/logout", {
              method: "POST",
              credentials: "include",
            });
            dispatch(removeUser());
            setOpenPop(false);
          }}
          className="px-3 py-2 font-light text-sm hover:text-slate-400 rounded-[4px] cursor-pointer transition-all"
        >
          Logout
        </li>
        {!user?.isArtist ? (
          <li
            onClick={() => {
              setOpen(true);
              setOpenPop(false);
            }}
            className="px-3 py-2 w-max font-light text-sm hover:text-slate-400 rounded-[4px] cursor-pointer transition-all"
          >
            Become Artist
          </li>
        ) : (
          <>
            <li
              onClick={() => {
                setOpenCreateAlbum(true);
                setOpenPop(false);
              }}
              className="px-3 py-2 w-max font-light text-sm hover:text-slate-400 rounded-[4px] cursor-pointer transition-all"
            >
              Create Album
            </li>
            <li
              onClick={() => {
                setOpenPop(false);
              }}
              className="px-3 py-2 w-max font-light text-sm hover:text-slate-400 rounded-[4px] cursor-pointer transition-all"
            >
              <Link to="/myAlbums">My Albums</Link>
            </li>
            <li
              onClick={async () => {
                await fetch("http://localhost:3000/artist/delete", {
                  method: "PATCH",
                  credentials: "include",
                });
                setOpenPop(false);
              }}
              className="px-3 py-2 w-max font-light text-sm hover:text-slate-400 rounded-[4px] cursor-pointer transition-all"
            >
              Remove Artist
            </li>
          </>
        )}
      </ul>
    </div>
  );
};

export default Navbar;
