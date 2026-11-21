// Turns what ChatGPT asks for ({ id } or { query }) into playable songs.
// Library first; a query nothing in the library matches is searched on YouTube.

const { searchYouTube, getYouTubeVideo, parseYouTubeId } = require("../youtube");
const { YOUTUBE_PREFIX, getSong, searchSongs, youtubeToPlayerSong } = require("./library");
const { rankYouTubeResults } = require("./rank");

/** How many YouTube lookups run at once */
const CONCURRENCY = 5;

async function youtubeById(videoId) {
  const video = await getYouTubeVideo(videoId);
  return video?.title ? youtubeToPlayerSong(video) : null;
}

/** A YouTube link, "yt:<id>" or bare video id -> the video id (no search needed) */
function youtubeIdOf(text) {
  const value = String(text || "").trim();
  if (value.startsWith(YOUTUBE_PREFIX)) return parseYouTubeId(value.slice(YOUTUBE_PREFIX.length));
  return /youtu\.?be/i.test(value) ? parseYouTubeId(value) : null;
}

async function resolveOne(item, { youtube }) {
  if (item.id) {
    const id = String(item.id).trim();
    const videoId = youtubeIdOf(id) ?? (id.length === 11 ? parseYouTubeId(id) : null);
    if (videoId) return youtube ? youtubeById(videoId) : null;
    return getSong(id);
  }

  const query = String(item.query || "").trim();
  if (!query) return null;
  // A YouTube link: look it up directly (no search quota)
  const linked = youtubeIdOf(query);
  if (linked) return youtube ? youtubeById(linked) : null;
  const [match] = await searchSongs(query, 1);
  if (match) return match;
  if (!youtube) return null;
  // The official version, not the top hit (often a status edit or remix)
  const [best] = rankYouTubeResults(await searchYouTube(query), query);
  return best ? youtubeToPlayerSong(best) : null;
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

module.exports = { resolveItems, youtubeIdOf, mapLimited };
