const Album = require("../models/Album");
const Artist = require("../models/Artist");
const Song = require("../models/Song");
const {
  fileUrl,
  getAudioDuration,
  getImageColors,
  removeFile,
} = require("../media");

async function create_album(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "No image file provided!" });
  }

  const { title, description } = req.body;
  const user = req.user;

  try {
    const artist = await Artist.findOne({ user: user._id, isActive: true });
    if (!artist) {
      await removeFile(req.file);
      return res.status(403).json({ message: "Only artists can create albums" });
    }
    const existing_album = await Album.findOne({ artist: artist._id, title });
    if (existing_album) {
      await removeFile(req.file);
      return res
        .status(409)
        .json({ message: "Album with the same title already exists" });
    }
    const album = await Album.create({
      title,
      description,
      artist: artist._id,
      photoUrl: fileUrl(req.file),
      colors: await getImageColors(req.file.path),
    });
    return res.json({ album, user });
  } catch (err) {
    await removeFile(req.file);
    return res.status(500).json({ message: "Server Error!", err: err.message });
  }
}

async function get_my_albums(req, res) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized!" });
  }
  try {
    const artist = await Artist.findOne({ user: user._id, isActive: true });
    if (!artist) {
      return res.json({ artist: null, albums: [] });
    }
    const albums = await Album.find({ artist: artist._id });
    return res.json({ artist, albums });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function get_album(req, res) {
  const albumId = req.params.albumId;
  if (!albumId) {
    return res.status(404).json({ message: "Album Id not found!" });
  }
  try {
    const album = await Album.findById(albumId);
    const songs = await Song.find({ album: albumId });
    return res.json({ album, songs });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function add_song_to_album(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Audio file is required" });
  }
  const { albumId } = req.params;
  const user = req.user;
  const { title } = req.body;
  try {
    const artist = await Artist.findOne({ user: user._id, isActive: true });
    if (!artist) {
      await removeFile(req.file);
      return res.status(403).json({ message: "Only artists can upload songs" });
    }
    const song = await Song.create({
      title,
      duration: await getAudioDuration(req.file.path),
      artist: artist._id,
      album: albumId,
      url: fileUrl(req.file),
    });
    await Album.updateOne({ _id: albumId }, { $addToSet: { songs: song._id } });
    return res.json({ song });
  } catch (err) {
    await removeFile(req.file);
    return res.status(500).json({ message: "Server Error!", err: err.message });
  }
}

module.exports = { create_album, get_my_albums, get_album, add_song_to_album };
