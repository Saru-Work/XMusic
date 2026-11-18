const mongoose = require("mongoose");
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: String,
  // Missing for accounts created with Google sign-in
  password: String,
  // Google account id ("sub"), set once the account has signed in with Google
  googleId: { type: String, index: { unique: true, sparse: true } },
  photoUrl: String,
  isArtist: { type: Boolean, default: false },
  likedSongs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
});

const User = mongoose.model("user", UserSchema);
module.exports = User;
