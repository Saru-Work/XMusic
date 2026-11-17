const mongoose = require("mongoose");
const Album = require("../models/Album");
const Artist = require("../models/Artist");
const Playlist = require("../models/Playlist");
const Song = require("../models/Song");
const { verifyToken } = require("../utils/jwt.util");

const SONG_COUNT = 8;
const ALBUM_COUNT = 10;
const PLAYLIST_COUNT = 10;

// The logged-in user's id, if any. Suggestions work without logging in,
// so a missing or bad token is not an error here.
function viewerId(req) {
  const token = req.cookies?.access_token;
  if (!token) return null;
  try {
    const { sub } = verifyToken(token);
    return mongoose.isValidObjectId(sub) ? new mongoose.Types.ObjectId(sub) : null;
  } catch {
    return null;
  }
}

// Random songs, albums and playlists for the home page.
// Every request returns a fresh random pick.
async function get_suggestions(req, res) {
  try {
    const activeArtists = (
      await Artist.find({ isActive: true }).select("_id")
    ).map((artist) => artist._id);

    const viewer = viewerId(req);
    const playlistMatch = { "songs.0": { $exists: true } };
    if (viewer) {
      // Don't suggest the viewer's own playlists
      playlistMatch.user = { $ne: viewer };
    }

    const [songs, albums, playlists] = await Promise.all([
      Song.aggregate([
        { $match: { artist: { $in: activeArtists } } },
        { $sample: { size: SONG_COUNT } },
      ]),
      Album.aggregate([
        { $match: { artist: { $in: activeArtists } } },
        { $sample: { size: ALBUM_COUNT } },
      ]),
      Playlist.aggregate([
        { $match: playlistMatch },
        { $sample: { size: PLAYLIST_COUNT } },
      ]),
    ]);

    await Promise.all([
      Song.populate(songs, { path: "artist" }),
      Album.populate(albums, {
        path: "artist",
        select: "title user profileUrl",
      }),
    ]);

    return res.json({ songs, albums, playlists });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

module.exports = { get_suggestions };
