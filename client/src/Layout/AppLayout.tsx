import React, { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store/store";
import { removeUser, storeUser } from "../reducers/userReducer";
import Sidebar from "../components/Sidebar";

const AppLayout = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const res = await fetch("http://localhost:3000/profile", {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        dispatch(removeUser());
        return;
      }
      const json = await res.json();
      setAuthenticated(true);
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
      <div className="flex justify-between gap-3">
        <Sidebar />
        <div className="flex-5 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
