#!/usr/bin/env node
// Control your open XMusic tab from the terminal (dev tool for the remote
// control that ChatGPT will use later).
//
//   npm run remote -- devices
//   npm run remote -- now
//   npm run remote -- play <search words> [--next | --append] [--shuffle]
//   npm run remote -- pause | resume | toggle | next | previous
//   npm run remote -- shuffle on|off
//   npm run remote -- repeat off|all|one
//
// Logs in with XMUSIC_EMAIL / XMUSIC_PASSWORD (from server/.env or the
// shell). `play` looks in your library first, then searches YouTube.

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), quiet: true });

const API = process.env.XMUSIC_API || `http://localhost:${process.env.PORT || 3000}`;
const LIBRARY_LIMIT = 20;
const YOUTUBE_LIMIT = 10;

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function call(path, { cookie, json } = {}) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: json ? "POST" : "GET",
      headers: {
        ...(json && { "Content-Type": "application/json" }),
        ...(cookie && { Cookie: `access_token=${cookie}` }),
      },
      body: json && JSON.stringify(json),
    });
  } catch {
    fail(`Can't reach the server at ${API}. Is it running?`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) fail(`${res.status}: ${data?.message || res.statusText}`);
  return data;
}

async function login() {
  const email = process.env.XMUSIC_EMAIL;
  const password = process.env.XMUSIC_PASSWORD;
  if (!email || !password) {
    fail("Set XMUSIC_EMAIL and XMUSIC_PASSWORD (in server/.env or your shell) to the account logged in to XMusic.");
  }
  const { token } = await call("/login", { json: { email, password } });
  return token;
}

/** Library songs whose title or artist contains every search word */
async function searchLibrary(query) {
  const songs = await call("/songs");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return (Array.isArray(songs) ? songs : songs.songs ?? [])
    .filter((song) => {
      const text = `${song.title} ${song.artist?.title ?? ""} ${song.channel ?? ""}`.toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .slice(0, LIBRARY_LIMIT);
}

/** Same shape as youtubeResultToSong in client/src/lib/youtube.ts */
async function searchYouTube(query) {
  const { results } = await call(`/youtube/search?q=${encodeURIComponent(query)}`);
  return results.slice(0, YOUTUBE_LIMIT).map((r) => ({
    _id: `yt:${r.videoId}`,
    title: r.title,
    url: `https://www.youtube.com/watch?v=${r.videoId}`,
    duration: r.duration,
    artist: null,
    source: "youtube",
    youtubeId: r.videoId,
    channel: r.channel,
  }));
}

function printNowPlaying(now) {
  if (!now?.song) return console.log("Nothing loaded.");
  const by = now.song.artist ? ` — ${now.song.artist}` : "";
  console.log(`${now.isPlaying ? "▶ Playing" : "⏸ Paused"}: ${now.song.title}${by}`);
  console.log(`  ${now.position}/${now.queueLength}  shuffle ${now.shuffle ? "on" : "off"}  repeat ${now.repeat}`);
  if (now.upNext?.length) console.log(`  Up next: ${now.upNext.join(" · ")}`);
}

function printAnswer(answer) {
  if (!answer.ok) console.log(`⚠ ${answer.reason}: ${answer.message ?? ""}`);
  console.log(`(${answer.device.label})`);
  printNowPlaying(answer.nowPlaying);
}

const CONTROL = ["pause", "resume", "toggle", "next", "previous"];

async function main() {
  const [name, ...rest] = process.argv.slice(2);
  const flags = new Set(rest.filter((a) => a.startsWith("--")));
  const args = rest.filter((a) => !a.startsWith("--"));
  if (!name) fail("Usage: npm run remote -- devices | now | play <words> | pause | resume | next | previous | shuffle on|off | repeat off|all|one");

  const cookie = await login();
  const send = (command) => call("/remote/command", { cookie, json: { from: "Terminal", ...command } });

  if (name === "devices" || name === "now") {
    const { devices } = await call("/remote/devices", { cookie });
    if (!devices.length) return console.log("No XMusic tab is open for this account.");
    for (const d of devices) {
      const seen = d.lastInteraction ? new Date(d.lastInteraction).toLocaleTimeString() : "never";
      console.log(`${d.label}  (last used ${seen}, autoplay ${d.canAutoplay ? "allowed" : "blocked until you click the tab"})`);
      if (name === "now") printNowPlaying(d.nowPlaying);
    }
    return;
  }

  if (name === "play") {
    const query = args.join(" ").trim();
    if (!query) fail("Usage: npm run remote -- play <search words>");
    let songs = await searchLibrary(query);
    let where = "your library";
    if (!songs.length) {
      songs = await searchYouTube(query);
      where = "YouTube";
    }
    if (!songs.length) fail(`No songs found for "${query}".`);
    console.log(`Found ${songs.length} on ${where}.`);
    const mode = flags.has("--next") ? "next" : flags.has("--append") ? "append" : "replace";
    return printAnswer(await send({ type: "play", songs, mode, ...(flags.has("--shuffle") && { shuffle: true }) }));
  }

  if (CONTROL.includes(name)) return printAnswer(await send({ type: "control", action: name }));
  if (name === "shuffle") {
    if (!["on", "off"].includes(args[0])) fail("Usage: npm run remote -- shuffle on|off");
    return printAnswer(await send({ type: "control", action: "shuffle", value: args[0] === "on" }));
  }
  if (name === "repeat") return printAnswer(await send({ type: "control", action: "repeat", value: args[0] }));

  fail(`Unknown command "${name}".`);
}

main();
