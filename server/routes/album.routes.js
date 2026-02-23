const express = require("express");
const {
  create_album,
  get_my_albums,
  get_album,
  add_song_to_album,
} = require("../controllers/album.controller");
const album_router = express.Router();
const { upload } = require("../upload");
const auth_middleware = require("../middleware/auth.middleware");

album_router.post(
  "/create",
  auth_middleware,
  upload.single("image"),
  create_album,
);
album_router.get("/myAlbums", auth_middleware, get_my_albums);
album_router.get("/:albumId", get_album);
album_router.post(
  "/:albumId/songs",
  auth_middleware,
  upload.single("audio"),
  add_song_to_album,
);

module.exports = album_router;
