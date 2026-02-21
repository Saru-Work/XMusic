import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import UploadPage from "./pages/UploadPage.tsx";
import ArtistPage from "./pages/ArtistPage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";
import { Provider } from "react-redux";
import { store } from "./store/store.ts";
import AppLayout from "./Layout/AppLayout.tsx";
import HomePage from "./pages/HomePage.tsx";
import MyAlbums from "./pages/MyAlbums.tsx";
import AlbumPage from "./pages/AlbumPage.tsx";
import ArtistDashboard from "./pages/ArtistDashboard.tsx";
import PlaylistPage from "./pages/PlaylistPage.tsx";
import Playlists from "./components/Playlists.tsx";
import AlbumsPage from "./pages/AlbumsPage.tsx";
import TracksPage from "./pages/TracksPage.tsx";
import GenrePage from "./pages/GenrePage.tsx";
import ArtistsPage from "./pages/ArtistsPage.tsx";
const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      {
        path: "/upload",
        element: <UploadPage />,
      },
      {
        path: "/artist/:artistId",
        element: <ArtistPage />,
      },
      {
        path: "/myAlbums",
        element: <MyAlbums />,
      },
      {
        path: "/album/:albumId",
        element: <AlbumPage />,
      },
      {
        path: "/myPlaylists",
        element: <Playlists />,
      },
      {
        path: "/artist/dashboard",
        element: <ArtistDashboard />,
      },
      {
        path: "/playlist/:playlistId",
        element: <PlaylistPage />,
      },
      {
        path: "/albums",
        element: <AlbumsPage />,
      },
      {
        path: "/tracks",
        element: <TracksPage />,
      },
      { path: "/genre", element: <GenrePage /> },
      {
        path: "/artists",
        element: <ArtistsPage />,
      },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
]);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>,
);
