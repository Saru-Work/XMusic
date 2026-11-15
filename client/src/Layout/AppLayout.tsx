import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../store/store";
import { removeUser, storeUser } from "../reducers/userReducer";
import Sidebar from "../components/Sidebar";
import Player from "../components/Player";

import { API_URL } from "@/lib/api";
const AppLayout = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { song } = useSelector((s: RootState) => s.song);
  useEffect(() => {
    async function checkAuth() {
      const res = await fetch(`${API_URL}/profile`, {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        dispatch(removeUser());
        return;
      }
      const json = await res.json();
      if (json) {
        dispatch(storeUser(json));
      } else {
        dispatch(removeUser());
      }
    }
    checkAuth();
  }, []);
  return (
    <div className="bg-black h-screen p-3">
      <Navbar />
      <div className="flex justify-between gap-3 h-[calc(100vh-100px)]">
        <Sidebar />
        <div className="flex-5 overflow-hidden">
          <Outlet />
        </div>
        {song && <Player song={song} />}
      </div>
    </div>
  );
};

export default AppLayout;
