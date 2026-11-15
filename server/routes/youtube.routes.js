const express = require("express");
const {
  parseYouTubeId,
  searchYouTube,
  getYouTubeVideo,
} = require("../youtube");

const youtube_router = express.Router();

function sendError(res, err) {
  return res
    .status(err.status || 500)
    .json({ message: err.status ? err.message : "Server Error!" });
}

// GET /youtube/search?q=...  -> { results: [{ videoId, title, channel, thumbnail, duration }] }
youtube_router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 200);
  if (!q) return res.json({ results: [] });
  try {
    return res.json({ results: await searchYouTube(q) });
  } catch (err) {
    return sendError(res, err);
  }
});

// GET /youtube/video/:id  -> { results: [video] }  (no API key needed)
youtube_router.get("/video/:id", async (req, res) => {
  const videoId = parseYouTubeId(req.params.id);
  if (!videoId) {
    return res.status(404).json({ message: "YouTube video not found. Check the link." });
  }
  try {
    return res.json({ results: [await getYouTubeVideo(videoId)] });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = youtube_router;
