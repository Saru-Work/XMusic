const mongoose = require("mongoose");

const ArtistSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  bio: {
    type: String,
    required: true,
  },
  profileUrl: {
    type: String,
    default: "https://cdn-icons-png.flaticon.com/512/666/666201.png",
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const Artist = mongoose.model("Artist", ArtistSchema);
module.exports = Artist;
