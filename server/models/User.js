const mongoose = require("mongoose");
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: String,
  password: String,
  photoUrl: String,
  isArtist: { type: Boolean, default: false },
  likedSongs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
});

const User = mongoose.model("user", UserSchema);
module.exports = User;
