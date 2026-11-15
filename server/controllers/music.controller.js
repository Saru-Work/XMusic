const Song = require("../models/Song");
const Artist = require("../models/Artist");
const { fileUrl, getAudioDuration, removeFile } = require("../media");

async function get_song(req, res) {
  try {
    const song = await Song.findById(req.params.id).populate("artist");
    if (!song) {
      return res.status(404).json({ message: "Song not found!" });
    }
    return res.json({ song });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function get_songs(req, res) {
  try {
    const songs = await Song.find({}).populate({
      path: "artist",
      match: { isActive: true },
    });
    res.json({ songs });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
}

async function upload_audio(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Audio file is required" });
  }
  try {
    const artist = await Artist.findOne({ user: req.user._id, isActive: true });
    if (!artist) {
      await removeFile(req.file);
      return res.status(403).json({ message: "Only artists can upload songs" });
    }
    const song = await Song.create({
      title: req.body.name || req.body.title,
      duration: await getAudioDuration(req.file.path),
      artist: artist._id,
      url: fileUrl(req.file),
    });
    return res.json({ song });
  } catch (err) {
    await removeFile(req.file);
    return res.status(500).json({ message: "Server Error!", err: err.message });
  }
}

module.exports = { get_song, get_songs, upload_audio };
