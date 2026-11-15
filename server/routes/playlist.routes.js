const express = require("express");
const auth_middleware = require("../middleware/auth.middleware");
const { upload } = require("../upload");
const {
  create_playlist,
  get_playlists,
  get_playlist,
  edit_playlist,
  delete_playlist,
  add_song_to_playlist,
  remove_song_from_playlist,
} = require("../controllers/playlist.controller");

const playlist_router = express.Router();

playlist_router.post("/create", auth_middleware, create_playlist);
playlist_router.get("/all", auth_middleware, get_playlists);
playlist_router.get("/get/:playlistId", get_playlist);
playlist_router.put(
  "/edit/:playlistId",
  auth_middleware,
  upload.single("image"),
  edit_playlist,
);
playlist_router.delete("/:playlistId", auth_middleware, delete_playlist);
playlist_router.post(
  "/:playlistId/song/:songId",
  auth_middleware,
  add_song_to_playlist,
);
playlist_router.delete(
  "/:playlistId/song/:songId",
  auth_middleware,
  remove_song_from_playlist,
);

module.exports = playlist_router;
