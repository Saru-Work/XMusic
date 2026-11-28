// Run with `npm test` in server/. The fixture holds real YouTube searches
// together with the signals the YouTube API returned for each video.

const test = require("node:test");
const assert = require("node:assert/strict");
const { judgeResult, officialResults } = require("../youtubeOfficial");
const searches = require("./fixtures/youtube-searches.json");

const search = (query) => searches.find((s) => s.query === query);
const titles = (results) => results.map((r) => r.title);
const official = (title, extra = {}) => ({
  title,
  channel: "Some Label",
  duration: 240,
  signals: { licensed: true, artTrack: false, subscribers: 5_000_000 },
  ...extra,
});

test("the first pick for each real search is an official upload", () => {
  const expected = {
    "moongil thoddam": /Sony ?Music/,
    "vaseegara minnale": /Saregama/,
    "new york nagaram": /Ayngaran|A\. R\. Rahman - Topic/,
    "kadhal kanave mundasupatti": /Think Music/,
    "imaye imaye raja rani g v prakash": /Think Music/,
    "nenjukkule kadal": /Sony ?Music/,
  };
  for (const [query, channel] of Object.entries(expected)) {
    const [best] = officialResults(search(query).results, query).results;
    assert.match(best.channel, channel, query);
  }
});

test("status clips, edits and re-uploads are left out of real searches", () => {
  const kept = searches.flatMap((s) => titles(officialResults(s.results, s.query).results)).join("\n");
  for (const unwanted of [
    /whatsapp status/i,
    /slowed/i,
    /reverb/i,
    /lofi/i,
    /bass boosted/i,
    /#shorts|#trending/i,
    /cover/i,
    /karaoke/i,
    /Aurora Lyrics/,
    /Bluray/i,
  ]) {
    assert.doesNotMatch(kept, unwanted);
  }
});

test("every real search keeps at least one result", () => {
  for (const s of searches) {
    assert.ok(officialResults(s.results, s.query).results.length > 0, s.query);
  }
});

test("hidden counts what was left out", () => {
  const s = search("naan nee naam");
  const { results, hidden } = officialResults(s.results, s.query);
  assert.equal(results.length + hidden, s.results.length);
  assert.ok(hidden > 0);
});

test("an edit counts when the listener asked for it", () => {
  const slowed = official("Song (Slowed + Reverb)");
  assert.equal(judgeResult(slowed, "song").official, false);
  assert.equal(judgeResult(slowed, "song slowed").official, true);
  assert.equal(judgeResult(slowed, "song reverb").official, true);
  assert.equal(judgeResult(slowed, "song cover").official, false);
  assert.equal(judgeResult(official("Song (Live in Chennai)"), "song live in chennai").official, true);
});

test("words match whole words only", () => {
  assert.equal(judgeResult(official("Song | Credits Roll"), "song").official, true);
  assert.equal(judgeResult(official("Live Forever"), "live forever").official, true);
  assert.equal(judgeResult(official("Discover the Covers of Song"), "song").official, true);
});

test("trust comes from licensing, art tracks, Topic channels or a big channel", () => {
  const unknown = { licensed: false, artTrack: false, subscribers: 20_000 };
  assert.equal(judgeResult(official("Song", { signals: unknown }), "song").official, false);
  assert.equal(judgeResult(official("Song", { signals: { ...unknown, licensed: true } }), "song").official, true);
  assert.equal(judgeResult(official("Song", { signals: { ...unknown, artTrack: true } }), "song").official, true);
  assert.equal(judgeResult(official("Song", { signals: unknown, channel: "Artist - Topic" }), "song").official, true);
  assert.equal(judgeResult(official("Song", { signals: { ...unknown, subscribers: 2_000_000 } }), "song").official, true);
  // Hidden subscriber counts aren't trusted on their own
  assert.equal(judgeResult(official("Song", { signals: { ...unknown, subscribers: null } }), "song").official, false);
});

test("without signals only the title, channel and length are checked", () => {
  assert.equal(judgeResult(official("Song", { signals: null }), "song").official, true);
  assert.equal(judgeResult(official("Song whatsapp status", { signals: null }), "song").official, false);
});

test("short clips and long compilations are not songs", () => {
  assert.equal(judgeResult(official("Song", { duration: 45 }), "song").official, false);
  assert.equal(judgeResult(official("Song", { duration: 0 }), "song").official, true);
  assert.equal(judgeResult(official("Hits", { duration: 3600 }), "hits").official, false);
  assert.equal(judgeResult(official("Hits Jukebox", { duration: 3600 }), "hits jukebox").official, true);
});

test("medleys of several songs are left out, a single collab name isn't", () => {
  assert.equal(judgeResult(official("A X B X C"), "a").official, false);
  assert.equal(judgeResult(official("Song | Star Music X Lyrically"), "song").official, true);
});

test("the closest title wins over a bigger channel", () => {
  const otherSong = official("Another Song - Video Song", { channel: "Big Label VEVO", signals: { licensed: true, artTrack: false, subscribers: 30_000_000 } });
  const rightSong = official("Naan Nee Naam", { channel: "Singer - Topic", signals: { licensed: true, artTrack: true, subscribers: 700 } });
  const [best] = officialResults([otherSong, rightSong], "naan nee naam").results;
  assert.equal(best, rightSong);
});

test("the version the listener asked for comes first", () => {
  const original = official("Song - Video Song");
  const slowed = official("Song (Slowed + Reverb)", { signals: { licensed: true, artTrack: false, subscribers: 50_000 } });
  assert.equal(officialResults([original, slowed], "song slowed").results[0], slowed);
  assert.equal(officialResults([original, slowed], "song").results[0], original);
});
