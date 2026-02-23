const express = require("express");

const {
  get_song,
  get_songs,
  upload_audio,
} = require("../controllers/music.controller");
const { upload } = require("../upload");
const music_router = express.Router();

music_router.get("/songs/:id", get_song);
music_router.get("/songs", get_songs);
music_router.post("/songs/upload", upload.single("audio"), upload_audio);
module.exports = music_router;
