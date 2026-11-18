const mongoose = require("mongoose");

// Saved YouTube search results. A search costs 100 of the API key's 10,000
// daily quota units, so the same query is answered from here for a week,
// even across server restarts. MongoDB deletes entries after SEARCH_DAYS.
const SEARCH_DAYS = 7;

const YouTubeSearchSchema = new mongoose.Schema({
  /** The query, trimmed and lower-cased */
  query: { type: String, required: true, unique: true },
  results: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now, expires: SEARCH_DAYS * 24 * 60 * 60 },
});

module.exports = mongoose.model("YouTubeSearch", YouTubeSearchSchema);
