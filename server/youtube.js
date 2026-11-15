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

module.exports = { parseYouTubeId, fetchYouTubeInfo, YouTubeError };
