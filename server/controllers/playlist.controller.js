const Playlist = require("../models/Playlist");
const { fileUrl } = require("../media");
async function create_playlist(req, res) {
  const { title } = req.body;
  const user = req.user;
  if (!title) {
    return res.status(404).json({ message: "Title is required" });
  }
  try {
    const playlist = await Playlist.create({ title, user: user._id });
    return res.json({ playlist });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function get_playlists(req, res) {
  const user = req.user;
  console.log(user);
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const playlists = await Playlist.find({ user: user._id });
    return res.json({ playlists });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function get_playlist(req, res) {
  const { playlistId } = req.params;

  if (!playlistId) {
    return res.status(404).json({ message: "Playlist ID required!" });
  }
  try {
    const playlist = await Playlist.findById(playlistId).populate("songs");
    return res.json({ playlist });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function edit_playlist(req, res) {
  const { playlistId } = req.params;
  const { title, description } = req.body;
  if (!playlistId) {
    return res.status(404).json({ message: "Playlist id is required" });
  }

  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized!" });
  }
  try {
    const update = { title, description };
    if (req.file) update.coverImage = fileUrl(req.file);
    const playlist = await Playlist.findOneAndUpdate(
      { _id: playlistId, user: user._id },
      update,
      { new: true },
    );
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found!" });
    }
    return res.json({ playlist });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}
async function add_song_to_playlist(req, res) {
  const { playlistId, songId } = req.params;

  try {
    const playlist = await Playlist.findOneAndUpdate(
      { _id: playlistId },
      { $addToSet: { songs: songId } },
      { new: true },
    );
    if (!playlist) {
      return res.status(404).json({ message: "Playlist not found!" });
    }
    return res.json({ playlist });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}
module.exports = {
  create_playlist,
  get_playlists,
  get_playlist,
  edit_playlist,
  add_song_to_playlist,
};
