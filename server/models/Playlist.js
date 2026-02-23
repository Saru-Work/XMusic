const mongoose = require("mongoose");

const PlaylistSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  coverImage: {
    type: String,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  description: {
    type: String,
    default: "",
  },
  songs: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
    },
  ],
});
PlaylistSchema.methods.addSong = (songId) => {
  if (!this.songs.includes(songId)) {
    this.songs.push(songId);
  }
};
const Playlist = mongoose.model("Playlist", PlaylistSchema);

module.exports = Playlist;
