const express = require("express");

const {
  get_song,
  get_songs,
  upload_audio,
  add_youtube_song,
  set_youtube_duration,
} = require("../controllers/music.controller");
const { upload } = require("../upload");
const auth_middleware = require("../middleware/auth.middleware");
const music_router = express.Router();

music_router.post("/songs/youtube", auth_middleware, add_youtube_song);
music_router.patch("/songs/:id/duration", set_youtube_duration);
music_router.get("/songs/:id", get_song);
music_router.get("/songs", get_songs);
music_router.post("/songs/upload", auth_middleware, upload.single("audio"), upload_audio);
module.exports = music_router;
