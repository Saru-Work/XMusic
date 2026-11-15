const Song = require("./models/Song");
const { parseYouTubeId, fetchYouTubeInfo, YouTubeError } = require("./youtube");

/**
 * Listeners can save YouTube videos (to playlists, to their liked songs)
 * without an XMusic artist being involved. Each video is stored once as an
 * artist-less Song and shared by everyone who saves it.
 */
async function findOrCreateYouTubeSong(videoIdOrUrl, durationInput) {
  const youtubeId = parseYouTubeId(videoIdOrUrl);
  if (!youtubeId) throw new YouTubeError("Invalid YouTube video", 400);
  const existing = await Song.findOne({
    source: "youtube",
    youtubeId,
    artist: { $exists: false },
  });
  if (existing) return existing;
  const info = await fetchYouTubeInfo(youtubeId);
  const duration = Number(durationInput);
  return Song.create({
    title: info.title,
    channel: info.channel,
    url: info.url,
    source: "youtube",
    youtubeId,
    duration:
      Number.isFinite(duration) && duration > 0 && duration < 86400
        ? Math.round(duration)
        : 0,
  });
}

module.exports = { findOrCreateYouTubeSong };
