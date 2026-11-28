// Helpers for songs that are played through the embedded YouTube player
// instead of an uploaded audio file.

const YouTubeSearch = require("./models/YouTubeSearch");

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
    const message = data?.error?.message || "";
    // The per-day search limit comes back as rateLimitExceeded ("... per day")
    const daily =
      reason === "quotaExceeded" ||
      reason === "dailyLimitExceeded" ||
      (reason === "rateLimitExceeded" && /per day/i.test(message));
    if (daily) {
      const err = new YouTubeError(
        "The daily YouTube search limit has been reached; it resets at midnight Pacific time. Paste a YouTube link instead, or play songs from your library.",
        429,
      );
      err.code = "quota";
      throw err;
    }
    if (reason === "rateLimitExceeded") {
      throw new YouTubeError("Too many YouTube searches right now. Try again in a minute.", 429);
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
 * What YouTube knows about who uploaded each video, used to tell the official
 * upload of a song from re-uploads and edits (see youtubeOfficial.js):
 * - licensed: uploaded by a content partner (a label or distributor)
 * - artTrack: an auto-generated "Provided to YouTube by <label>" track
 * - subscribers: the channel's subscriber count (null when hidden)
 */
async function videoDetails(videoIds) {
  const videos = new Map();
  if (!videoIds.length) return videos;
  const data = await callApi("videos", {
    part: "snippet,contentDetails,status",
    id: videoIds.join(","),
  });
  for (const video of data.items || []) videos.set(video.id, video);
  return videos;
}

async function channelSubscribers(channelIds) {
  const subscribers = new Map();
  if (!channelIds.length) return subscribers;
  const data = await callApi("channels", {
    part: "statistics",
    id: channelIds.join(","),
  });
  for (const channel of data.items || []) {
    const stats = channel.statistics || {};
    subscribers.set(
      channel.id,
      stats.hiddenSubscriberCount ? null : Number(stats.subscriberCount) || 0,
    );
  }
  return subscribers;
}

/**
 * Adds lengths and `signals` to search results (2 quota units for up to 50
 * videos). Videos YouTube no longer returns (deleted, private) or that can't
 * be embedded are dropped. If the lookup fails the results come back as they
 * are, with `signals: null`.
 */
async function withSignals(results) {
  let videos;
  try {
    videos = await videoDetails(results.map((r) => r.videoId));
  } catch {
    return results.map((r) => ({ ...r, signals: null }));
  }
  const channelIds = [...new Set([...videos.values()].map((v) => v.snippet?.channelId).filter(Boolean))];
  let subscribers = new Map();
  try {
    subscribers = await channelSubscribers(channelIds);
  } catch {
    // Still useful without channel sizes
  }
  return results
    .filter((r) => videos.has(r.videoId) && videos.get(r.videoId).status?.embeddable !== false)
    .map((r) => {
      const video = videos.get(r.videoId);
      return {
        ...r,
        duration: parseIsoDuration(video.contentDetails?.duration) || r.duration || 0,
        signals: {
          licensed: video.contentDetails?.licensedContent === true,
          artTrack: /^Provided to YouTube by /.test(video.snippet?.description || ""),
          subscribers: subscribers.get(video.snippet?.channelId) ?? null,
        },
      };
    });
}

/**
 * Searches YouTube for embeddable music videos (YouTube Data API v3).
 * Returns [{ videoId, title, channel, thumbnail, duration, signals }].
 */
async function searchYouTube(query) {
  const q = String(query || "").trim();
  if (!q) return [];
  const cacheKey = q.toLowerCase().replace(/\s+/g, " ");
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.results;
  const remember = (results) => {
    if (searchCache.size > 500) searchCache.clear();
    searchCache.set(cacheKey, { results, expires: Date.now() + SEARCH_TTL });
  };

  // Searched in the last week (survives restarts; saves quota)
  try {
    const saved = await YouTubeSearch.findOne({ query: cacheKey }).lean();
    if (saved) {
      let { results } = saved;
      // Saved before results carried signals: look them up (2 units, not a new search)
      if (results.some((r) => !("signals" in r))) {
        results = await withSignals(results);
        if (results.some((r) => r.signals)) {
          YouTubeSearch.updateOne({ query: cacheKey }, { $set: { results } }).catch(() => {});
        }
      }
      remember(results);
      return results;
    }
  } catch {
    // No database: just search
  }

  const search = await callApi("search", {
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    videoCategoryId: "10", // Music
    // Same cost as 15; leaves enough once unofficial uploads are filtered out
    maxResults: "25",
    q,
  });
  const items = (search.items || []).filter((item) => item.id?.videoId);
  const results = await withSignals(
    items.map((item) => ({
      videoId: item.id.videoId,
      title: decodeEntities(item.snippet?.title),
      channel: decodeEntities(item.snippet?.channelTitle),
      thumbnail:
        item.snippet?.thumbnails?.medium?.url ||
        `https://i.ytimg.com/vi/${item.id.videoId}/mqdefault.jpg`,
      duration: 0,
    })),
  );
  remember(results);
  YouTubeSearch.updateOne(
    { query: cacheKey },
    { $set: { results, createdAt: new Date() } },
    { upsert: true },
  ).catch(() => {});
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

const HOUR = 60 * 60 * 1000;
const cache = new Map();

/**
 * Runs `load` once per `ttl` for `key` and shares the result (and any
 * in-flight request). Failures are not cached, so the next call retries.
 */
function remember(key, ttl, load) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise;
  const promise = load();
  cache.set(key, { promise, expires: Date.now() + ttl });
  promise.catch(() => cache.delete(key));
  if (cache.size > 500) {
    for (const [k, entry] of cache) if (entry.expires <= Date.now()) cache.delete(k);
  }
  return promise;
}

/** "Artist - Topic" (YouTube's auto-generated music channels) -> "Artist" */
function channelName(title) {
  return decodeEntities(title).replace(/ - Topic$/, "");
}

function thumbnailOf(snippet, fallback) {
  const t = snippet?.thumbnails;
  return t?.medium?.url || t?.high?.url || t?.default?.url || fallback;
}

/** A videos.list item -> { videoId, title, channel, thumbnail, duration } */
function videoResult(video) {
  return {
    videoId: video.id,
    title: decodeEntities(video.snippet?.title),
    channel: channelName(video.snippet?.channelTitle),
    thumbnail: thumbnailOf(
      video.snippet,
      `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`,
    ),
    duration: parseIsoDuration(video.contentDetails?.duration),
  };
}

/** Most popular music videos right now (1 quota unit, cached for 6 hours) */
function trendingMusic() {
  return remember("trending", 6 * HOUR, async () => {
    const data = await callApi("videos", {
      part: "snippet,contentDetails,status",
      chart: "mostPopular",
      videoCategoryId: "10", // Music
      maxResults: "50",
    });
    return (data.items || [])
      .filter((video) => video.status?.embeddable !== false)
      .map(videoResult);
  });
}

/**
 * Playlists matching `q` that have at least one video
 * (search = 100 quota units, so results are cached for a day).
 * Returns [{ playlistId, title, channel, thumbnail, itemCount }].
 */
function searchPlaylists(q) {
  return remember(`playlists:${q}`, 24 * HOUR, async () => {
    const search = await callApi("search", {
      part: "snippet",
      type: "playlist",
      maxResults: "25",
      q,
    });
    const items = (search.items || []).filter((item) => item.id?.playlistId);
    if (!items.length) return [];
    const details = await callApi("playlists", {
      part: "contentDetails",
      id: items.map((item) => item.id.playlistId).join(","),
    });
    const counts = new Map(
      (details.items || []).map((p) => [p.id, p.contentDetails?.itemCount ?? 0]),
    );
    return items
      .filter((item) => counts.get(item.id.playlistId) > 0)
      .map((item) => ({
        playlistId: item.id.playlistId,
        title: decodeEntities(item.snippet?.title),
        channel: channelName(item.snippet?.channelTitle),
        thumbnail: thumbnailOf(item.snippet, null),
        itemCount: counts.get(item.id.playlistId),
      }));
  });
}

const GENRES = [
  "pop",
  "hip hop",
  "rock",
  "r&b",
  "indie",
  "electronic",
  "jazz",
  "lofi",
  "k-pop",
  "latin",
  "country",
  "classical",
  "bollywood",
  "afrobeats",
];

function randomPick(list, count) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

// "Nas - Illmatic (Full Album)", "... [Full Album]", "Album Complet", ...
const FULL_ALBUM = /full album|album complet[oe]?|álbum completo/i;

/** "Nas - Illmatic (Full Album)" -> "Nas - Illmatic" */
function albumTitle(title) {
  const tag = new RegExp(FULL_ALBUM.source, "gi");
  const cleaned = title
    .replace(new RegExp(`\\s*[([]\\s*(?:${FULL_ALBUM.source})\\s*[)\\]]`, "gi"), "")
    .replace(tag, "")
    .replace(/([([])\s*[-–—|•:]\s*/g, "$1") // "( - Remastered)" -> "(Remastered)"
    .replace(/[([]\s*[)\]]/g, "") // empty brackets
    .replace(/^[\s\-–—|•:]+|[\s\-–—|•:]+$/g, "")
    .replace(/\s{2,}/g, " ");
  return cleaned || title;
}

/**
 * Playlist search results that look like a single album: the title says
 * "Full Album" (or YouTube Music made it) and it has an album's length.
 * Compilations like "600 Greatest Hip Hop Songs" are left out.
 */
function pickAlbums(results) {
  return results
    .filter(
      (p) =>
        (p.playlistId.startsWith("OLAK5uy_") || FULL_ALBUM.test(p.title)) &&
        p.itemCount >= 5 &&
        p.itemCount <= 40,
    )
    .map((p) => ({
      ...p,
      title: albumTitle(p.title),
    }));
}

/**
 * Random YouTube tracks, albums and playlists for the home page.
 * Each section is optional: if one YouTube call fails the others still show.
 */
async function youtubeSuggestions() {
  const [albumGenre, playlistGenre] = randomPick(GENRES, 2);
  const [tracks, albums, playlists] = await Promise.allSettled([
    trendingMusic(),
    searchPlaylists(`${albumGenre} full album`),
    searchPlaylists(`${playlistGenre} playlist`),
  ]);
  const failed = [tracks, albums, playlists].filter((r) => r.status === "rejected");
  if (failed.length === 3) throw failed[0].reason;
  const value = (result) => (result.status === "fulfilled" ? result.value : []);

  return {
    tracks: randomPick(value(tracks), 8),
    albums: randomPick(pickAlbums(value(albums)), 10),
    playlists: randomPick(value(playlists), 10),
    albumGenre,
    playlistGenre,
  };
}

const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;

/**
 * A YouTube playlist or album with its first 50 playable videos
 * (3 quota units, cached for 6 hours). Private, deleted and
 * non-embeddable videos are left out.
 */
function getYouTubePlaylist(playlistId) {
  if (!PLAYLIST_ID.test(String(playlistId || ""))) {
    return Promise.reject(new YouTubeError("YouTube playlist not found.", 404));
  }
  return remember(`playlist:${playlistId}`, 6 * HOUR, async () => {
    const info = await callApi("playlists", {
      part: "snippet,contentDetails",
      id: playlistId,
    });
    const meta = info.items?.[0];
    if (!meta) throw new YouTubeError("YouTube playlist not found.", 404);

    const items = await callApi("playlistItems", {
      part: "contentDetails",
      playlistId,
      maxResults: "50",
    });
    const videoIds = (items.items || [])
      .map((item) => item.contentDetails?.videoId)
      .filter(Boolean);

    let results = [];
    if (videoIds.length) {
      // Unavailable videos are simply missing from this response
      const videos = await callApi("videos", {
        part: "snippet,contentDetails,status",
        id: videoIds.join(","),
      });
      const byId = new Map(
        (videos.items || [])
          .filter((video) => video.status?.embeddable !== false)
          .map((video) => [video.id, videoResult(video)]),
      );
      results = videoIds.map((id) => byId.get(id)).filter(Boolean);
    }

    return {
      playlist: {
        playlistId,
        title: decodeEntities(meta.snippet?.title),
        channel: channelName(meta.snippet?.channelTitle),
        description: decodeEntities(meta.snippet?.description),
        thumbnail: thumbnailOf(meta.snippet, null),
        itemCount: meta.contentDetails?.itemCount ?? results.length,
      },
      results,
    };
  });
}

module.exports = {
  parseYouTubeId,
  fetchYouTubeInfo,
  searchYouTube,
  getYouTubeVideo,
  youtubeSuggestions,
  getYouTubePlaylist,
  YouTubeError,
};
