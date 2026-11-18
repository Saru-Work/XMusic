// Turns what ChatGPT asks for ({ id } or { query }) into playable songs.
// Library first; a query nothing in the library matches is searched on YouTube.

const { searchYouTube, getYouTubeVideo, parseYouTubeId } = require("../youtube");
const { YOUTUBE_PREFIX, getSong, searchSongs, youtubeToPlayerSong } = require("./library");

/** How many YouTube lookups run at once */
const CONCURRENCY = 5;

async function youtubeById(videoId) {
  const video = await getYouTubeVideo(videoId);
  return video?.title ? youtubeToPlayerSong(video) : null;
}

async function resolveOne(item, { youtube }) {
  if (item.id) {
    const id = String(item.id).trim();
    if (id.startsWith(YOUTUBE_PREFIX)) {
      const videoId = parseYouTubeId(id.slice(YOUTUBE_PREFIX.length));
      return videoId && youtube ? youtubeById(videoId) : null;
    }
    return getSong(id);
  }

  const query = String(item.query || "").trim();
  if (!query) return null;
  const [match] = await searchSongs(query, 1);
  if (match) return match;
  if (!youtube) return null;
  const [top] = await searchYouTube(query);
  return top ? youtubeToPlayerSong(top) : null;
}

/** Runs `fn` over `list` with at most `limit` in flight, keeping order */
async function mapLimited(list, limit, fn) {
  const results = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      results[i] = await fn(list[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return results;
}

/**
 * items: [{ id } | { query }]
 * -> { songs: SongType[] (in order, duplicates dropped), missing: [{ item, reason }] }
 */
async function resolveItems(items, { youtube = true } = {}) {
  const missing = [];
  const found = await mapLimited(items, CONCURRENCY, async (item) => {
    try {
      const song = await resolveOne(item, { youtube });
      if (!song) missing.push({ item, reason: "not found" });
      return song;
    } catch (err) {
      // e.g. YouTube search not configured or over quota
      missing.push({ item, reason: err.status ? err.message : "lookup failed" });
      return null;
    }
  });
  const seen = new Set();
  const songs = found.filter((song) => song && !seen.has(song._id) && seen.add(song._id));
  return { songs, missing };
}

module.exports = { resolveItems };
