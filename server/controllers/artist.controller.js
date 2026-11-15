const mongoose = require("mongoose");
const Artist = require("../models/Artist");
const { fileUrl, removeFile } = require("../media");
const User = require("../models/User");
const Song = require("../models/Song");
const Album = require("../models/Album");
async function get_artists(req, res) {
  try {
    const artists = await Artist.find({ isActive: true });
    if (!artists) {
      return res.status(404).json({ message: "Artists not found!" });
    }
    return res.json({ artists });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function get_artist(req, res) {
  const artist_id = req.params.artistId;
  try {
    if (!mongoose.isValidObjectId(artist_id)) {
      return res.status(404).json({ message: "Artist not found!" });
    }
    const artist = await Artist.findById(artist_id);
    if (!artist || !artist.isActive) {
      return res.status(404).json({ message: "Artist not found!" });
    }
    const songs = await Song.find({ artist: artist_id });
    const albums = await Album.find({ artist: artist_id }).populate(
      "artist",
      "title user profileUrl",
    );
    return res.json({ artist, songs, albums });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}
async function get_songs(req, res) {
  const artist_id = req.params.artistId;
  if (!artist_id) return res.status(404).json({ message: "Artist ID not found" });
  try {
    const songs = await Song.find({ artist: artist_id });
    return res.json({ songs });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}
async function create_artist(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "No image file provided!" });
  }

  const title = (req.body.title || "").trim();
  const bio = (req.body.bio || "").trim();
  const user = req.user;

  try {
    if (!title || !bio) {
      await removeFile(req.file);
      return res.status(400).json({ message: "Name and bio are required" });
    }
    if (user.isArtist) {
      await removeFile(req.file);
      return res.status(409).json({ message: "You are already an Artist!" });
    }
    const artist = await Artist.create({
      title,
      bio,
      user: user._id,
      profileUrl: fileUrl(req.file),
    });
    user.isArtist = true;
    await user.save();
    return res.json({ artist, user });
  } catch (err) {
    await removeFile(req.file);
    return res.status(500).json({ message: "Server Error!", err: err.message });
  }
}

async function delete_artist(req, res) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized!" });
  try {
    await Artist.updateMany({ user: user._id }, { isActive: false });
    const updated = await User.findOneAndUpdate(
      { _id: user._id },
      { isArtist: false },
      { new: true },
    ).select("-password");
    return res.json({ message: "Successfully Deleted", user: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!", err: err.message });
  }
}

module.exports = {
  get_artists,
  get_artist,
  create_artist,
  delete_artist,
  get_songs,
};
