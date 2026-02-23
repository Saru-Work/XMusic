const express = require("express");
const auth_middleware = require("../middleware/auth.middleware");
const { upload } = require("../upload");
const {
  create_playlist,
  get_playlists,
  get_playlist,
  edit_playlist,
  add_song_to_playlist,
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
playlist_router.post("/:playlistId/song/:songId", add_song_to_playlist);

module.exports = playlist_router;
