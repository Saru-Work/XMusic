const mongoose = require("mongoose");
const Play = require("../models/Play");
const Song = require("../models/Song");
const { parseYouTubeId } = require("../youtube");
const { playable, toPlayerSong, youtubeToPlayerSong, YOUTUBE_PREFIX } = require("../mcp/library");

const RECENT_LIMIT = 50;
const MAX_SECONDS = 86400;
const PLAY_ID = /^[\w-]{8,64}$/;

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const seconds = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.min(Math.max(number, 0), MAX_SECONDS)) : 0;
};

/** What a report says was played, or null when there's no such song */
async function playedSong(body) {
  if (body.videoId !== undefined) {
    const youtubeId = parseYouTubeId(text(body.videoId, 200));
    const title = text(body.title, 300);
    if (!youtubeId || !title) return null;
    return {
      key: `${YOUTUBE_PREFIX}${youtubeId}`,
      youtubeId,
      title,
      channel: text(body.channel, 200),
      duration: seconds(body.duration),
    };
  }
  if (typeof body.songId !== "string" || !mongoose.isValidObjectId(body.songId)) return null;
  const song = await Song.findById(body.songId);
  if (!song) return null;
  // A saved YouTube video counts as the same song as its search result
  const isVideo = song.source === "youtube" && !song.artist;
  return {
    key: isVideo ? `${YOUTUBE_PREFIX}${song.youtubeId}` : String(song._id),
    song: song._id,
    ...(song.youtubeId && { youtubeId: song.youtubeId }),
    title: song.title,
    ...(song.channel && { channel: song.channel }),
    duration: song.duration,
  };
}

// PUT /history/plays/:playId
// body: { songId } or { videoId, title, channel?, duration? },
//       plus { seconds, completed?, skipped? }
// Reports of the same play may repeat or arrive out of order.
async function report_play(req, res) {
  const { playId } = req.params;
  const body = req.body || {};
  if (!PLAY_ID.test(playId)) {
    return res.status(400).json({ message: "Invalid play id" });
  }
  try {
    const played = await playedSong(body);
    if (!played) return res.status(404).json({ message: "Song not found!" });
    const listened = seconds(body.seconds);
    const outcome = {
      ...(body.completed === true && { completed: true }),
      ...(body.skipped === true && { skipped: true }),
    };
    const write = () =>
      Play.updateOne(
        { user: req.user._id, playId },
        {
          $setOnInsert: { ...played, startedAt: new Date(Date.now() - listened * 1000) },
          $max: { seconds: listened },
          ...(Object.keys(outcome).length && { $set: outcome }),
        },
        { upsert: true },
      );
    try {
      await write();
    } catch (err) {
      // Two reports inserted at the same moment: the second one updates
      if (err.code !== 11000) throw err;
      await write();
    }
    return res.json({ message: "Saved" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server Error!" });
  }
}

// GET /history -> { songs } recently played, newest first, each song once
async function get_history(req, res) {
  try {
    const plays = await Play.aggregate([
      { $match: { user: req.user._id } },
      { $sort: { startedAt: -1 } },
      { $limit: 2000 },
      { $group: { _id: "$key", play: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$play" } },
      { $sort: { startedAt: -1 } },
      // Some extra, because songs that no longer exist are left out below
      { $limit: RECENT_LIMIT * 2 },
    ]);
    const found = await Song.find({
      _id: { $in: plays.map((p) => p.song).filter(Boolean) },
    }).populate("artist", "title isActive");
    const byId = new Map(found.map((s) => [String(s._id), s]));
    const songs = [];
    for (const play of plays) {
      const song = play.song && byId.get(String(play.song));
      if (song) {
        if (playable(song)) songs.push(toPlayerSong(song));
      } else if (play.key.startsWith(YOUTUBE_PREFIX)) {
        songs.push(
          youtubeToPlayerSong({
            videoId: play.youtubeId,
            title: play.title,
            channel: play.channel,
            duration: play.duration,
          }),
        );
      }
    }
    return res.json({ songs: songs.slice(0, RECENT_LIMIT) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server Error!" });
  }
}

// DELETE /history
async function clear_history(req, res) {
  try {
    await Play.deleteMany({ user: req.user._id });
    return res.json({ message: "Listening history cleared" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server Error!" });
  }
}

module.exports = { report_play, get_history, clear_history };
