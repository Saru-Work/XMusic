// Orders YouTube search results so the official version of a song comes
// first, not a WhatsApp-status edit, a slowed / 8D remix or a cover.

/** Words that mark a re-upload or edit, unless the listener asked for them */
const EDIT_WORDS = [
  "status",
  "whatsapp",
  "8d",
  "slowed",
  "reverb",
  "sped up",
  "lofi",
  "lo-fi",
  "remix",
  "cover",
  "karaoke",
  "instrumental",
  "bgm",
  "ringtone",
  "shorts",
  "#shorts",
  "edit",
  "mashup",
  "reaction",
  "fan made",
  "tiktok",
  "reels",
  "nightcore",
  "bass boosted",
];

/** Signs of an upload by the artist or label */
const OFFICIAL_TITLE = [
  "official video",
  "official music video",
  "official audio",
  "official lyric",
  "official full",
  "official",
  "full video song",
  "video song",
  "lyrical",
  "lyric video",
  "audio song",
];
const OFFICIAL_CHANNEL = /( - topic$|vevo|records|music|studios|entertainment|official|films|series|label)/i;

const wordsOf = (text) => String(text || "").toLowerCase().match(/[\p{L}\p{N}#']+/gu) ?? [];

function hasPhrase(text, phrase) {
  // Whole words only: "edit" shouldn't match "credits"
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

/** Higher = more likely the official version of what `query` asks for */
function scoreResult(result, query, position) {
  const title = String(result.title || "").toLowerCase();
  const channel = String(result.channel || "");
  const asked = String(query || "").toLowerCase();
  let score = 0;

  // How much of the query the title / channel cover
  const queryWords = wordsOf(asked);
  const haystack = `${title} ${channel.toLowerCase()}`;
  if (queryWords.length) {
    const covered = queryWords.filter((w) => haystack.includes(w)).length;
    score += (covered / queryWords.length) * 4;
  }

  for (const word of EDIT_WORDS) {
    if (!hasPhrase(title, word)) continue;
    // Asked for a slowed / lofi / cover version: that's the one to play
    score += hasPhrase(asked, word) ? 5 : -5;
  }
  if (OFFICIAL_TITLE.some((phrase) => title.includes(phrase))) score += 3;
  if (OFFICIAL_CHANNEL.test(channel)) score += 2;

  // Status clips and shorts are short; jukeboxes and full albums are long
  const seconds = result.duration || 0;
  const wantsLong = /jukebox|full album|all songs|non ?stop|mashup/.test(asked);
  if (seconds > 0 && seconds < 60) score -= 6;
  else if (seconds > 0 && seconds < 110) score -= 2;
  else if (seconds > 15 * 60 && !wantsLong) score -= 3;

  // YouTube's own order breaks ties
  return score - position * 0.15;
}

/** Results best-first */
function rankYouTubeResults(results, query) {
  return results
    .map((result, position) => ({ result, score: scoreResult(result, query, position) }))
    .sort((a, b) => b.score - a.score)
    .map(({ result }) => result);
}

module.exports = { rankYouTubeResults, scoreResult };
