// Helpers for songs that are played through the embedded YouTube player
// instead of an uploaded audio file.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/**
 * Accepts a YouTube / YouTube Music link (watch, youtu.be, shorts, embed, live)
 * or a bare 11-character video id. Returns the video id or null.
 */
function parseYouTubeId(input) {
  const value = String(input || "").trim();
  if (VIDEO_ID.test(value)) return value;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  let id = null;
  if (host === "youtu.be") {
    id = url.pathname.split("/")[1];
  } else if (HOSTS.has(host)) {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") id = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(first)) id = second;
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

class YouTubeError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Looks the video up through YouTube's public oEmbed endpoint (no API key).
 * Confirms that it exists and may be embedded, and returns its title.
 */
async function fetchYouTubeInfo(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let res;
  try {
    res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`,
      { signal: AbortSignal.timeout(8000) },
    );
  } catch {
    throw new YouTubeError("Couldn't reach YouTube. Try again in a moment.", 502);
  }
  if (res.status === 401 || res.status === 403) {
    throw new YouTubeError(
      "This video can't be played outside YouTube (embedding is disabled or it is private).",
      400,
    );
  }
  if (!res.ok) {
    throw new YouTubeError("YouTube video not found. Check the link.", 404);
  }
  const data = await res.json();
  return { title: data.title, channel: data.author_name, url: watchUrl };
}

const API = "https://www.googleapis.com/youtube/v3";
const SEARCH_TTL = 60 * 60 * 1000; // a search costs 100 quota units, so reuse results
const searchCache = new Map();

function decodeEntities(text) {
  const named = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
  return String(text || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code) => {
    if (code[0] !== "#") return named[code.toLowerCase()] ?? match;
    const point =
      code[1].toLowerCase() === "x"
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
    return Number.isFinite(point) ? String.fromCodePoint(point) : match;
  });
}

/** "PT1H2M3S" -> 3723 (0 for live streams, which have no length) */
function parseIsoDuration(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value || "");
  if (!match) return 0;
  const [, h = 0, m = 0, sec = 0] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(sec);
}

async function callApi(path, params) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new YouTubeError(
      "YouTube search isn't set up yet. Add YOUTUBE_API_KEY to server/.env and restart the server.",
      503,
    );
  }
  let res;
  try {
    res = await fetch(`${API}/${path}?${new URLSearchParams({ ...params, key })}`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new YouTubeError("Couldn't reach YouTube. Try again in a moment.", 502);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new YouTubeError(
        "The daily YouTube search limit has been reached. Try again tomorrow, or paste a YouTube link instead.",
        429,
      );
    }
    console.error("YouTube API error:", res.status, data?.error?.message);
    throw new YouTubeError(
      res.status === 400 || res.status === 403
        ? "YouTube rejected the request. Check that YOUTUBE_API_KEY is valid and the YouTube Data API v3 is enabled for it."
        : "YouTube search failed. Try again in a moment.",
      502,
    );
  }
  return data;
}

/**
 * Searches YouTube for embeddable music videos (YouTube Data API v3).
 * Returns [{ videoId, title, channel, thumbnail, duration }].
 */
async function searchYouTube(query) {
  const q = String(query || "").trim();
  if (!q) return [];
  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.results;

  const search = await callApi("search", {
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    videoCategoryId: "10", // Music
    maxResults: "15",
    q,
  });
  const items = (search.items || []).filter((item) => item.id?.videoId);

  // Lengths come from a second, cheap call
  const durations = new Map();
  if (items.length) {
    try {
      const details = await callApi("videos", {
        part: "contentDetails",
        id: items.map((item) => item.id.videoId).join(","),
      });
      for (const video of details.items || []) {
        durations.set(video.id, parseIsoDuration(video.contentDetails?.duration));
      }
    } catch {
      // Results are still usable without lengths
    }
  }

  const results = items.map((item) => ({
    videoId: item.id.videoId,
    title: decodeEntities(item.snippet?.title),
    channel: decodeEntities(item.snippet?.channelTitle),
    thumbnail:
      item.snippet?.thumbnails?.medium?.url ||
      `https://i.ytimg.com/vi/${item.id.videoId}/mqdefault.jpg`,
    duration: durations.get(item.id.videoId) || 0,
  }));
  if (searchCache.size > 500) searchCache.clear();
  searchCache.set(cacheKey, { results, expires: Date.now() + SEARCH_TTL });
  return results;
}

/** One video by id, without needing an API key (used for pasted links) */
async function getYouTubeVideo(videoId) {
  const info = await fetchYouTubeInfo(videoId);
  return {
    videoId,
    title: info.title,
    channel: info.channel,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    duration: 0,
  };
}

module.exports = {
  parseYouTubeId,
  fetchYouTubeInfo,
  searchYouTube,
  getYouTubeVideo,
  YouTubeError,
};
