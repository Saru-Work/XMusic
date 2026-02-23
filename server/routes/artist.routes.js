const express = require("express");
const path = require("path");
const {
  get_artists,
  get_artist,
  create_artist,
  delete_artist,
  get_songs,
} = require("../controllers/artist.controller");
const auth_middleware = require("../middleware/auth.middleware");
const { upload } = require("../upload");
const artist_router = express.Router();

artist_router.get("/artists", get_artists);
artist_router.get("/artist/:artistId", get_artist);
artist_router.get("/artist/:artistId/songs", get_songs);
artist_router.post(
  "/artist/createArtist",
  auth_middleware,
  upload.single("image"),
  create_artist,
);
artist_router.patch("/artist/delete", auth_middleware, delete_artist);
module.exports = artist_router;
