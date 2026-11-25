const mongoose = require("mongoose");

/**
 * One listen of one song by one listener. The player reports it once the song
 * has really been playing for a few seconds and again when it ends.
 */
const PlaySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  /** Chosen by the player, so the reports of one listen update one document */
  playId: { type: String, required: true },
  /** What was played: a Song id, or "yt:<videoId>" for a YouTube video */
  key: { type: String, required: true },
  /** Set when it's a song in the XMusic catalog */
  song: { type: mongoose.Schema.Types.ObjectId, ref: "Song" },
  // YouTube search results aren't stored as Songs just for being played, so
  // the play keeps what is needed to show and replay them.
  youtubeId: String,
  title: String,
  channel: String,
  duration: { type: Number, default: 0 },
  startedAt: { type: Date, required: true },
  /** Seconds actually listened (not counting pauses and seeking) */
  seconds: { type: Number, default: 0 },
  /** Played to the end */
  completed: { type: Boolean, default: false },
  /** Left early: skipped, or the player was closed */
  skipped: { type: Boolean, default: false },
});

PlaySchema.index({ user: 1, playId: 1 }, { unique: true });
PlaySchema.index({ user: 1, startedAt: -1 });

module.exports = mongoose.model("Play", PlaySchema);
