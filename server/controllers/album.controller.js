const Album = require("../models/Album");
const streamifier = require("streamifier");
const Artist = require("../models/Artist");
const Song = require("../models/Song");
const cloudinary = require("cloudinary").v2;
async function create_album(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "No image file provided!" });
  }

  const { title, description } = req.body;
  const user = req.user;

  try {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "images",
        colors: true,
      },
      async (error, result) => {
        if (error)
          return res.status(500).json({ message: "Server Error!", error });
        const existing_album = await Album.findOne({ user: user._id, title });
        if (existing_album) {
          return res
            .status(409)
            .json({ message: "Album with the same title already exists" });
        }
        console.log(result);
        const artist = await Artist.findOne({ user: user._id });
        const album = await Album.create({
          title,
          description,
          artist: artist._id,
          photoUrl: result.secure_url,
          colors: result.colors.map((color) => ({
            hex: color[0],
            percentage: color[1],
          })),
        });
        console.log(
          result.colors.map((color) => ({
            hex: color[0],
            percentage: color[1],
          })),
        );
        return res.json({ album, user });
      },
    );

    streamifier.createReadStream(req.file.buffer).pipe(stream);
  } catch (err) {
    return res.status(500).json({ message: "Server Error!", err: err.message });
  }
}

async function get_my_albums(req, res) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized!" });
  }
  try {
    const artistres = await Artist.findOne({ user: user._id, isActive: true });
    const albums = await Album.find({ artist: artistres._id });
    return res.json({ artistres, albums });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function get_album(req, res) {
  const albumId = req.params.albumId;
  console.log(albumId);
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
    return res.status(404).json({ message: "Audio file is required" });
  }
  const { albumId } = req.params;
  const user = req.user;
  const { title } = req.body;
  try {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "video",
        folder: "audios",
      },
      async (error, result) => {
        if (error)
          return res.status(500).json({ message: "Server Error!", error });

        const artist = await Artist.findOne({ user: user._id });
        const song = await Song.create({
          title,
          duration: Math.round(result.duration),
          artist: artist.id,
          album: albumId,
          url: result.secure_url,
        });
        console.log(result);
        return res.json({ song });
      },
    );
    streamifier.createReadStream(req.file.buffer).pipe(stream);
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

module.exports = { create_album, get_my_albums, get_album, add_song_to_album };
