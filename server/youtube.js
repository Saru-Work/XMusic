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
