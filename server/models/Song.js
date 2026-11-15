const mongoose = require("mongoose");

const SongSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  // 0 when unknown (a YouTube song whose length couldn't be read yet)
  duration: {
    type: Number,
    required: true,
  },
  // "upload": `url` is an audio file we serve.
  // "youtube": played with the embedded YouTube player using `youtubeId`.
  source: {
    type: String,
    enum: ["upload", "youtube"],
    default: "upload",
  },
  youtubeId: {
    type: String,
  },
  // Missing for YouTube songs that listeners saved to a playlist straight
  // from YouTube search (they don't belong to an XMusic artist).
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Artist",
  },
  // YouTube channel name, shown in place of the artist for those songs
  channel: {
    type: String,
  },
  album: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Album",
  },
});

const Song = mongoose.model("Song", SongSchema);

module.exports = Song;
