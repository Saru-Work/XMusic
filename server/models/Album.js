const mongoose = require("mongoose");

const AlbumSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  photoUrl: {
    type: String,
    default:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQIH9dvtGxnXnBt-by1FhoSsSFcwjxNbuD79A&s",
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Artist",
  },
  songs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
  colors: [
    {
      hex: String,
      percentage: Number,
    },
  ],
});

const Album = mongoose.model("Album", AlbumSchema);

module.exports = Album;
