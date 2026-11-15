const mongoose = require("mongoose");
const Song = require("../models/Song");
const Artist = require("../models/Artist");
const { fileUrl, getAudioDuration, removeFile } = require("../media");
const {
  parseYouTubeId,
  fetchYouTubeInfo,
  YouTubeError,
} = require("../youtube");

// Validates a "add YouTube song" request body and returns the Song fields.
// Throws a YouTubeError (with an HTTP status) when the link can't be used.
async function youtubeSongFields(body) {
  const youtubeId = parseYouTubeId(body?.url);
  if (!youtubeId) {
    throw new YouTubeError("Enter a valid YouTube or YouTube Music link.", 400);
  }
  const info = await fetchYouTubeInfo(youtubeId);
  const title = String(body?.title || "").trim() || info.title;
  if (!title) {
    throw new YouTubeError("Song title is required", 400);
  }
  // The length is read by the embedded player in the browser
  const duration = Number(body?.duration);
  return {
    title,
    url: info.url,
    source: "youtube",
    youtubeId,
    duration:
      Number.isFinite(duration) && duration > 0 && duration < 86400
        ? Math.round(duration)
        : 0,
  };
}

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
    const songs = await Song.find({})
      .sort({ _id: -1 })
      .populate({
        path: "artist",
        match: { isActive: true },
      });
    // Songs of deactivated artists come back with artist === null
    res.json({ songs: songs.filter((song) => song.artist) });
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

// Adds a single that plays from YouTube (JSON body: { url, title?, duration? })
async function add_youtube_song(req, res) {
  try {
    const artist = await Artist.findOne({ user: req.user._id, isActive: true });
    if (!artist) {
      return res.status(403).json({ message: "Only artists can add songs" });
    }
    const fields = await youtubeSongFields(req.body);
    const song = await Song.create({ ...fields, artist: artist._id });
    return res.json({ song });
  } catch (err) {
    return res
      .status(err.status || 500)
      .json({ message: err.status ? err.message : "Server Error!" });
  }
}

// YouTube only reports a video's length once it plays, so a song can be saved
// with duration 0. The player calls this the first time it learns the length.
// It can only fill in a missing value, never change an existing one.
async function set_youtube_duration(req, res) {
  const duration = Math.round(Number(req.body?.duration));
  if (
    !mongoose.isValidObjectId(req.params.id) ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration >= 86400
  ) {
    return res.status(400).json({ message: "Invalid duration" });
  }
  try {
    const song = await Song.findOneAndUpdate(
      { _id: req.params.id, source: "youtube", duration: 0 },
      { duration },
      { new: true },
    );
    return res.json({ updated: Boolean(song) });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

module.exports = {
  set_youtube_duration,
  get_song,
  get_songs,
  upload_audio,
  add_youtube_song,
  youtubeSongFields,
};
