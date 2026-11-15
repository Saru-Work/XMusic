const mongoose = require("mongoose");
const Song = require("../models/Song");
const User = require("../models/User");
const { findOrCreateYouTubeSong } = require("../youtubeSong");

function sendError(res, err) {
  return res
    .status(err.status || 500)
    .json({ message: err.status ? err.message : "Server Error!" });
}

// GET /likes -> { songs } newest first
async function get_likes(req, res) {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "likedSongs",
      populate: { path: "artist", select: "title" },
    });
    const songs = (user?.likedSongs || []).filter(Boolean).reverse();
    return res.json({ songs });
  } catch (err) {
    return sendError(res, err);
  }
}

// POST /likes  body: { songId } for a library song, or { videoId, duration? }
// for a YouTube search result. Responds with the liked song.
async function like_song(req, res) {
  try {
    let song = null;
    if (req.body?.videoId) {
      song = await findOrCreateYouTubeSong(req.body.videoId, req.body.duration);
    } else if (mongoose.isValidObjectId(req.body?.songId)) {
      song = await Song.findById(req.body.songId);
    }
    if (!song) {
      return res.status(404).json({ message: "Song not found!" });
    }
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { likedSongs: song._id } },
    );
    await song.populate("artist", "title");
    return res.json({ song });
  } catch (err) {
    return sendError(res, err);
  }
}

// DELETE /likes/:songId
async function unlike_song(req, res) {
  const { songId } = req.params;
  if (!mongoose.isValidObjectId(songId)) {
    return res.status(404).json({ message: "Song not found!" });
  }
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { likedSongs: songId } },
    );
    return res.json({ message: "Removed from liked songs" });
  } catch (err) {
    return sendError(res, err);
  }
}

module.exports = { get_likes, like_song, unlike_song };
