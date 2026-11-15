const mongoose = require("mongoose");
const Playlist = require("../models/Playlist");
const Song = require("../models/Song");
const { fileUrl, removeFile } = require("../media");

async function create_playlist(req, res) {
  const title = (req.body?.title || "").trim();
  const user = req.user;
  if (!title) {
    return res.status(400).json({ message: "Title is required" });
  }
  try {
    const playlist = await Playlist.create({ title, user: user._id });
    return res.json({ playlist });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function get_playlists(req, res) {
  try {
    const playlists = await Playlist.find({ user: req.user._id });
    return res.json({ playlists });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function get_playlist(req, res) {
  const { playlistId } = req.params;
  if (!mongoose.isValidObjectId(playlistId)) {
    return res.status(404).json({ message: "Playlist not found!" });
  }
  try {
    const playlist = await Playlist.findById(playlistId).populate({
      path: "songs",
      populate: { path: "artist", select: "title" },
    });
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found!" });
    }
    return res.json({ playlist });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

// Finds a playlist that belongs to the logged-in user, or sends the error response
async function findOwnPlaylist(req, res) {
  const { playlistId } = req.params;
  const playlist = mongoose.isValidObjectId(playlistId)
    ? await Playlist.findById(playlistId)
    : null;
  if (!playlist) {
    res.status(404).json({ message: "Playlist not found!" });
    return null;
  }
  if (!playlist.user.equals(req.user._id)) {
    res.status(403).json({ message: "You can only change your own playlists" });
    return null;
  }
  return playlist;
}

async function edit_playlist(req, res) {
  const title = (req.body?.title || "").trim();
  const description = (req.body?.description || "").trim();
  try {
    const playlist = await findOwnPlaylist(req, res);
    if (!playlist) {
      await removeFile(req.file);
      return;
    }
    if (!title) {
      await removeFile(req.file);
      return res.status(400).json({ message: "Title is required" });
    }
    playlist.title = title;
    playlist.description = description;
    if (req.file) playlist.coverImage = fileUrl(req.file);
    await playlist.save();
    return res.json({ playlist });
  } catch (err) {
    await removeFile(req.file);
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function delete_playlist(req, res) {
  try {
    const playlist = await findOwnPlaylist(req, res);
    if (!playlist) return;
    await playlist.deleteOne();
    return res.json({ message: "Playlist deleted" });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function add_song_to_playlist(req, res) {
  const { songId } = req.params;
  try {
    const playlist = await findOwnPlaylist(req, res);
    if (!playlist) return;
    const song = mongoose.isValidObjectId(songId)
      ? await Song.findById(songId)
      : null;
    if (!song) {
      return res.status(404).json({ message: "Song not found!" });
    }
    await playlist.updateOne({ $addToSet: { songs: song._id } });
    return res.json({ message: "Song added" });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function remove_song_from_playlist(req, res) {
  const { songId } = req.params;
  try {
    const playlist = await findOwnPlaylist(req, res);
    if (!playlist) return;
    await playlist.updateOne({ $pull: { songs: songId } });
    return res.json({ message: "Song removed" });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

module.exports = {
  create_playlist,
  get_playlists,
  get_playlist,
  edit_playlist,
  delete_playlist,
  add_song_to_playlist,
  remove_song_from_playlist,
};
