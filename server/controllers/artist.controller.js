const Artist = require("../models/Artist");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
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
    const artist = await Artist.findById(artist_id);
    const songs = await Song.find({ artist: artist_id });
    const albums = await Album.find({ artist: artist_id });
    if (!artist) {
      return res.status(404).json({ message: "Artist not found!" });
    }
    return res.json({ artist, songs, albums });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}
async function get_songs(req, res) {
  const artist_id = req.params.artistId;
  if (!artist_id) res.status(404).json({ message: "Artist ID not found" });
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

  const { title, bio } = req.body;
  const user = req.user;

  try {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "images",
      },
      async (error, result) => {
        if (error) return res.status(500).json({ message: "Server Error!" });
        if (user.isArtist) {
          return res
            .status(409)
            .json({ message: "You are already an Artist!" });
        }
        const artist = await Artist.create({
          title,
          bio,
          user: user._id,
          profileUrl: result.secure_url,
        });
        user.isArtist = true;
        await user.save();
        return res.json({ artist, user });
      },
    );

    streamifier.createReadStream(req.file.buffer).pipe(stream);
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function delete_artist(req, res) {
  const user = req.user;
  if (!user) res.status(404).json({ message: "Unauthorized!" });
  try {
    const response = await Artist.findOneAndUpdate(
      { user: user._id },
      { isActive: false },
    );
    const response1 = await User.findOneAndUpdate(
      { _id: user._id },
      { isArtist: false },
    );
    return res.json({ message: "Successfully Deleted" });
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
