const mongoose = require("mongoose");

const ArtistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
});
