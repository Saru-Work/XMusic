const express = require("express");
const {get_song, get_songs} = require("../controllers/music.controller");
const music_router = express.Router();

music_router.get("/songs/:id",get_song)
music_router.get("/songs",get_songs)

module.exports = music_router;