const mongoose = require("mongoose");
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  email: String,
  password: String,
  photoUrl: String,
  isArtist: { type: Boolean, default: false },
});

const User = mongoose.model("user", UserSchema);
module.exports = User;
