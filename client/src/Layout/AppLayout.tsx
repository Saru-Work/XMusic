import { useEffect } from "react";
import { Outlet } from "react-router-dom";
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
import { api } from "@/lib/api";

const AppLayout = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { song } = useSelector((s: RootState) => s.song);
  useEffect(() => {
    api<UserState>("/profile")
      .then((user) => dispatch(storeUser(user)))
      .catch(() => dispatch(removeUser()));
  }, [dispatch]);
  return (
    <div className="flex h-dvh flex-col gap-3 bg-black p-3">
      <Navbar />
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">
          <Sidebar />
          <main className="min-h-0 min-w-0 flex-1 overflow-auto rounded-[4px] bg-[rgba(44,40,40,0.4)]">
            <Outlet />
          </main>
        </div>
        {song && <Player song={song} />}
      </div>
    </div>
  );
};

export default AppLayout;
