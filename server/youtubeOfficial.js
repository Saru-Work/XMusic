// Decides whether a YouTube search result is the official upload of a song,
// so that WhatsApp-status clips, slowed / 8D / lofi edits, covers and
// re-uploads by random channels don't get played in its place.
//
// A result counts as official when nothing marks it as an edit and YouTube
// vouches for who uploaded it (see `signals` in youtube.js): a label or
// distributor uploaded it (licensed), it is an auto-generated art track
// ("Provided to YouTube by ..."), or it comes from a large channel.

/** Words that mark an edit or another version, unless the listener asked for them */
const EDIT_WORDS = [
  "status",
  "whatsapp",
  "slowed",
  "reverb",
  "sped up",
  "8d",
  "lofi",
  "lo-fi",
  "lo fi",
  "bass boosted",
  "nightcore",
  "remix",
  "mashup",
  "retuned",
  "cover",
  "karaoke",
  "instrumental",
  "bgm",
  "ringtone",
  "reaction",
  "fan made",
  "tiktok",
  "reels",
  "shorts",
  "#shorts",
  "edit",
  "unplugged",
  "reprise",
  "acapella",
  "a cappella",
  "piano",
  "guitar",
  "fingerstyle",
  "tutorial",
  "teaser",
  "trailer",
];
/** Live versions: only these phrases, so a song called "Live Forever" still counts */
const LIVE_WORDS = ["live in", "live at", "(live)", "[live]", "live performance", "live concert", "live version"];
/** Words that come together: asking for "slowed" also allows "slowed + reverb" */
const VARIANTS = [
  ["slowed", "reverb", "sped up", "lofi", "lo-fi", "lo fi"],
  ["status", "whatsapp", "shorts", "#shorts", "reels", "tiktok"],
  ["cover", "unplugged", "acapella", "a cappella", "piano", "guitar", "fingerstyle"],
  ["remix", "mashup", "retuned", "bass boosted", "nightcore", "8d", "edit"],
  ["instrumental", "bgm", "karaoke"],
  LIVE_WORDS,
];
const variantOf = (word) => VARIANTS.find((group) => group.includes(word)) ?? [word];

/** Channel names of edit / status / lyrics re-upload channels */
const EDIT_CHANNEL = /(^|[^\p{L}])(edit[sz]?|status|slowed|reverb|lofi|8d)([^\p{L}]|$)/iu;
/** Asking for one of these means a long video is wanted */
const LONG_WORDS = /jukebox|full album|all songs|non ?stop|back ?to ?back|playlist|mashup|medley/;

/** Signs of an upload by the artist or label (for ordering only) */
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

/** Shorter than this is a clip, not a song */
const MIN_SECONDS = 60;
/** Longer than this is a compilation, not a song */
const MAX_SECONDS = 15 * 60;
/** A channel this big is trusted even without the licensed flag */
const BIG_CHANNEL = 1_000_000;

const wordsOf = (text) => String(text || "").toLowerCase().match(/[\p{L}\p{N}#']+/gu) ?? [];
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole words only: "edit" shouldn't match "credits" */
function hasPhrase(text, phrase) {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(phrase)}($|[^\\p{L}\\p{N}])`, "iu");
  return pattern.test(text);
}

/**
 * -> { official, reason, score }
 * `reason` says why a result isn't official (null when it is); `score`
 * orders official results, higher first.
 */
function judgeResult(result, query = "") {
  const title = String(result.title || "").toLowerCase();
  const channel = String(result.channel || "");
  const asked = String(query || "").toLowerCase();
  const seconds = Number(result.duration) || 0;
  const signals = result.signals ?? null;
  const topic = / - Topic$/.test(channel);
  const notOfficial = (reason) => ({ official: false, reason, score: -Infinity });

  const edit = [...EDIT_WORDS, ...LIVE_WORDS].find(
    (word) => hasPhrase(title, word) && !variantOf(word).some((w) => hasPhrase(asked, w)),
  );
  if (edit) return notOfficial(`a "${edit}" version`);
  if (EDIT_CHANNEL.test(channel) && !EDIT_CHANNEL.test(asked)) return notOfficial("from an edits channel");
  // "Song A X Song B X Song C" medleys (one " X " is often a channel collab)
  if ((title.match(/\s[x×]\s/g) ?? []).length >= 2 && !LONG_WORDS.test(asked)) return notOfficial("a mashup");
  if ((title.match(/#[\p{L}\p{N}_]+/gu) ?? []).length >= 3) return notOfficial("a hashtag clip");
  if (seconds > 0 && seconds < MIN_SECONDS) return notOfficial("a short clip");
  if (seconds > MAX_SECONDS && !LONG_WORDS.test(asked)) return notOfficial("a compilation");

  // Without signals (the lookup failed) only the checks above can be made
  if (signals) {
    const big = signals.subscribers !== null && signals.subscribers >= BIG_CHANNEL;
    if (!signals.licensed && !signals.artTrack && !topic && !big) {
      return notOfficial("not uploaded by the artist or a label");
    }
  }

  let score = 0;
  // How much of the query the title / channel cover. This outweighs
  // everything below: the right song from a small channel beats another
  // song from a big label.
  const queryWords = wordsOf(asked);
  if (queryWords.length) {
    const haystack = `${title} ${channel.toLowerCase()}`;
    const covered = queryWords.filter((word) => haystack.includes(word)).length;
    score += (covered / queryWords.length) * 10;
  }
  // Asked for a slowed / cover / live version: that version comes first
  if (EDIT_WORDS.some((word) => hasPhrase(asked, word) && hasPhrase(title, word))) score += 5;
  if (OFFICIAL_TITLE.some((phrase) => title.includes(phrase))) score += 2;
  if (OFFICIAL_CHANNEL.test(channel)) score += 1;
  if (signals?.artTrack || topic) score += 1.5;
  if (signals?.licensed) score += 1;
  // Label channels have millions of subscribers; re-uploaders have thousands
  if (signals?.subscribers) score += Math.min(3, Math.max(0, Math.log10(signals.subscribers) - 4));
  if (seconds > 0 && seconds < 110) score -= 1;
  return { official: true, reason: null, score };
}

/**
 * Official results best-first (YouTube's own order breaks ties), and how many
 * were left out.
 */
function officialResults(results, query) {
  const judged = results.map((result, position) => ({ result, position, ...judgeResult(result, query) }));
  const official = judged
    .filter((j) => j.official)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .map((j) => j.result);
  return { results: official, hidden: results.length - official.length };
}

module.exports = { judgeResult, officialResults };
