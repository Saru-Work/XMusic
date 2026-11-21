// The tools ChatGPT (or any MCP client) can call. Each MCP request builds
// these for one listener (`userId`); they find music in the catalog and send
// it to that listener's open XMusic tab through the remote-control hub.

const { z } = require("zod");
const { validateCommand } = require("../realtime/commands");
const { pickDevice, sendCommand, RemoteError } = require("../realtime/hub");
const { searchYouTube, getYouTubeVideo } = require("../youtube");
const { resolveItems, youtubeIdOf } = require("./resolve");
const { rankYouTubeResults } = require("./rank");
const {
  searchSongs,
  searchCollections,
  collectionSongs,
  listPlaylists,
  youtubeToPlayerSong,
} = require("./library");

const FROM = "ChatGPT";
const MAX_PLAY_ITEMS = 50;
const MAX_COLLECTION_SONGS = 100;

// ---- results -------------------------------------------------------------

const result = (text, structuredContent) => ({
  content: [{ type: "text", text }],
  ...(structuredContent && { structuredContent }),
});
const failure = (text) => ({ content: [{ type: "text", text }], isError: true });

/** Compact song for tool output; `id` can be passed back to `play` */
function brief(song) {
  return {
    id: song._id,
    title: song.title,
    artist: (song.artist && typeof song.artist === "object" ? song.artist.title : null) ?? song.channel ?? null,
    duration: song.duration || 0,
    source: song.source,
  };
}

function describeNowPlaying(now) {
  if (!now?.song) return "Nothing is loaded in the player.";
  const by = now.song.artist ? ` by ${now.song.artist}` : "";
  const state = now.isPlaying ? "Now playing" : "Paused on";
  const lines = [`${state} "${now.song.title}"${by} (song ${now.position} of ${now.queueLength}).`];
  if (now.upNext?.length) lines.push(`Up next: ${now.upNext.map((t) => `"${t}"`).join(", ")}.`);
  lines.push(`Shuffle ${now.shuffle ? "on" : "off"}, repeat ${now.repeat}.`);
  return lines.join(" ");
}

/** What to tell ChatGPT when the tab answered but something didn't work */
function explainProblem(answer) {
  if (answer.reason === "autoplay_blocked") {
    return "The songs are loaded, but the browser blocked autoplay because the XMusic tab hasn't been clicked since it was opened. Ask the user to click anywhere in the XMusic tab once; playback starts on that click.";
  }
  return answer.message || `The player reported: ${answer.reason}.`;
}

/** Sends a command to the listener's tab; turns hub errors into tool errors */
async function send(userId, command) {
  try {
    return { answer: await sendCommand(userId, validateCommand({ from: FROM, ...command })) };
  } catch (err) {
    if (err instanceof RemoteError) {
      return { error: failure(err.code === "no_device" ? `${err.message} XMusic only plays in an open browser tab.` : err.message) };
    }
    throw err;
  }
}

function playResult(answer, { intro, missing = [] }) {
  const parts = [intro];
  if (!answer.ok) parts.push(explainProblem(answer));
  parts.push(describeNowPlaying(answer.nowPlaying));
  if (missing.length) {
    parts.push(`Couldn't find: ${missing.map((m) => JSON.stringify(m.item.query ?? m.item.id)).join(", ")}.`);
  }
  return result(parts.join(" "), {
    ok: answer.ok,
    ...(answer.reason && { reason: answer.reason }),
    nowPlaying: answer.nowPlaying,
    ...(missing.length && { missing: missing.map((m) => ({ ...m.item, reason: m.reason })) }),
  });
}

// ---- schemas -------------------------------------------------------------

const playMode = z
  .enum(["replace", "next", "append"])
  .default("replace")
  .nullable()
  .describe('"replace" starts these songs now (default); "next" plays them after the current song; "append" adds them to the end of the queue.');

const shuffle = z.boolean().nullish().describe("Turn shuffle on or off for this queue. Leave out to keep the listener's setting.");

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
const playerChange = { readOnlyHint: false, destructiveHint: false, idempotentHint: false };

// ---- tools ---------------------------------------------------------------

/** The scope a token needs for each tool */
const TOOL_SCOPES = {
  search_music: "music:read",
  get_now_playing: "music:read",
  list_my_library: "music:read",
  play: "player:control",
  play_collection: "player:control",
  control_playback: "player:control",
};

function registerTools(server, { userId, scopes = Object.values(TOOL_SCOPES) }) {
  // Only offer what the listener allowed this app to do
  const register = (name, config, handler) => {
    if (scopes.includes(TOOL_SCOPES[name])) server.registerTool(name, config, handler);
  };

  register(
    "search_music",
    {
      title: "Search music",
      description:
        "Search the listener's XMusic library (songs, albums, artists, playlists) and, unless turned off, YouTube. " +
        "XMusic has no mood or genre tags: to find music for a mood (e.g. sad, upbeat), think of fitting songs yourself and pass them to `play` as queries, or search for words likely to be in titles. " +
        "Returned song ids can be passed to `play`; album / artist / playlist ids to `play_collection`. " +
        "YouTube results are ordered official-version first (re-uploads, status edits, slowed / 8D versions and covers last, unless asked for). " +
        "A YouTube link or video id as the query is looked up directly and returns that video's real title: this works even when the daily YouTube search limit is reached.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(200)
          .describe("Words to search for (a title, artist, album or playlist name), or a YouTube link / video id to look up."),
        limit: z.number().int().min(1).max(25).default(10).nullable().describe("Maximum songs per source."),
        include_youtube: z.boolean().default(true).nullable().describe("Also search YouTube."),
      },
      annotations: { ...readOnly, openWorldHint: true },
    },
    async ({ query, limit: maxSongs, include_youtube: withYoutube }) => {
      const limit = maxSongs ?? 10;
      const include_youtube = withYoutube ?? true;
      // A YouTube link / id: look the one video up (free, no search quota)
      const linked = youtubeIdOf(query) ?? (/^[A-Za-z0-9_-]{11}$/.test(query.trim()) ? query.trim() : null);
      if (linked) {
        try {
          const song = brief(youtubeToPlayerSong(await getYouTubeVideo(linked)));
          return result(`That YouTube video is "${song.title}" by ${song.artist}. Its id for \`play\` is ${song.id}.`, {
            library: { songs: [], albums: [], artists: [], playlists: [] },
            youtube: [song],
          });
        } catch (err) {
          return failure(err.status ? err.message : "Couldn't look that YouTube video up.");
        }
      }
      const [songs, collections] = await Promise.all([searchSongs(query, limit), searchCollections(query)]);
      let youtube = [];
      let youtubeNote = null;
      if (include_youtube) {
        try {
          youtube = rankYouTubeResults(await searchYouTube(query), query).slice(0, limit).map(youtubeToPlayerSong);
        } catch (err) {
          youtubeNote = err.status ? err.message : "YouTube search failed.";
        }
      }
      const data = {
        library: { songs: songs.map(brief), ...collections },
        youtube: youtube.map(brief),
        ...(youtubeNote && { youtubeNote }),
      };
      const counts = [
        `${songs.length} library songs`,
        `${collections.albums.length} albums`,
        `${collections.artists.length} artists`,
        `${collections.playlists.length} playlists`,
        include_youtube ? `${youtube.length} YouTube songs` : null,
      ].filter(Boolean);
      return result(`Found ${counts.join(", ")} for "${query}".${youtubeNote ? ` (${youtubeNote})` : ""}\n${JSON.stringify(data)}`, data);
    },
  );

  register(
    "play",
    {
      title: "Play songs",
      description:
        "Play songs in the listener's open XMusic browser tab. Give each song as an `id` (from search_music), a `query` " +
        '("Someone Like You Adele") or a YouTube link; queries match the library first, then the best YouTube result (the official version, not a status edit or remix). ' +
        "If YouTube search is unavailable (daily limit), YouTube links and ids still play, and the result shows each video's real title so you can confirm it's the right one. " +
        "For a request like \"play some sad songs\", choose 8-15 fitting songs yourself and pass them as queries.",
      inputSchema: {
        items: z
          .array(
            z
              .object({
                id: z.string().nullish().describe("A song id from search_music (library id or yt:<videoId>)."),
                query: z.string().max(200).nullish().describe('Song to look up, best as "Title Artist".'),
              })
              .refine((item) => item.id || item.query, "Each item needs an id or a query"),
          )
          .min(1)
          .max(MAX_PLAY_ITEMS),
        mode: playMode,
        shuffle,
      },
      annotations: { ...playerChange, openWorldHint: true },
    },
    async ({ items, mode: playAs, shuffle: shuffleOn }) => {
      const mode = playAs ?? "replace";
      const { songs, missing } = await resolveItems(items);
      if (!songs.length) {
        return failure(`None of the songs could be found: ${missing.map((m) => `${JSON.stringify(m.item.query ?? m.item.id)} (${m.reason})`).join(", ")}.`);
      }
      const { answer, error } = await send(userId, { type: "play", songs, mode, shuffle: shuffleOn ?? undefined });
      if (error) return error;
      const intro =
        mode === "replace"
          ? `Sent ${songs.length} song${songs.length === 1 ? "" : "s"} to XMusic.`
          : `Added ${songs.length} song${songs.length === 1 ? "" : "s"} ${mode === "next" ? "to play next" : "to the end of the queue"}.`;
      return playResult(answer, { intro, missing });
    },
  );

  register(
    "play_collection",
    {
      title: "Play a playlist, album, artist or liked songs",
      description:
        "Play every song of a playlist, album or artist (id from search_music or list_my_library), or the listener's liked songs.",
      inputSchema: {
        type: z.enum(["playlist", "album", "artist", "liked"]),
        id: z.string().nullish().describe("Required unless type is \"liked\"."),
        mode: playMode,
        shuffle,
      },
      annotations: playerChange,
    },
    async ({ type, id, mode: playAs, shuffle: shuffleOn }) => {
      const mode = playAs ?? "replace";
      if (type !== "liked" && !id) return failure(`An id is needed to play ${type === "album" || type === "artist" ? "an" : "a"} ${type}.`);
      const collection = await collectionSongs(type, id, userId);
      if (!collection) return failure(`That ${type} wasn't found.`);
      if (!collection.songs.length) return failure(`"${collection.title}" has no songs that can be played.`);
      const songs = collection.songs.slice(0, MAX_COLLECTION_SONGS);
      const { answer, error } = await send(userId, { type: "play", songs, mode, shuffle: shuffleOn ?? undefined });
      if (error) return error;
      return playResult(answer, { intro: `Sent ${songs.length} songs from "${collection.title}" to XMusic.` });
    },
  );

  register(
    "control_playback",
    {
      title: "Control playback",
      description: "Pause, resume, skip, go back, or change shuffle / repeat in the listener's XMusic tab.",
      inputSchema: {
        action: z.enum([
          "pause",
          "resume",
          "next",
          "previous",
          "shuffle_on",
          "shuffle_off",
          "repeat_off",
          "repeat_all",
          "repeat_one",
        ]),
      },
      annotations: playerChange,
    },
    async ({ action }) => {
      const [name, value] = action.split("_");
      const command =
        name === "shuffle"
          ? { type: "control", action: "shuffle", value: value === "on" }
          : name === "repeat"
            ? { type: "control", action: "repeat", value }
            : { type: "control", action };
      const { answer, error } = await send(userId, command);
      if (error) return error;
      const text = answer.ok
        ? describeNowPlaying(answer.nowPlaying)
        : `${explainProblem(answer)} ${describeNowPlaying(answer.nowPlaying)}`;
      return result(text, {
        ok: answer.ok,
        ...(answer.reason && { reason: answer.reason }),
        nowPlaying: answer.nowPlaying,
      });
    },
  );

  register(
    "get_now_playing",
    {
      title: "What's playing",
      description: "What the listener's XMusic tab is playing right now, plus the next few songs and shuffle / repeat.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => {
      const device = pickDevice(userId);
      if (!device) return failure("No XMusic tab is open. Open XMusic in the browser and log in.");
      return result(describeNowPlaying(device.nowPlaying), { nowPlaying: device.nowPlaying, device: device.label });
    },
  );

  register(
    "list_my_library",
    {
      title: "List my playlists or liked songs",
      description: "The listener's own playlists (ids for play_collection) or their liked songs.",
      inputSchema: { kind: z.enum(["playlists", "liked"]) },
      annotations: readOnly,
    },
    async ({ kind }) => {
      if (kind === "playlists") {
        const playlists = await listPlaylists(userId);
        return result(
          playlists.length ? `${playlists.length} playlists:\n${JSON.stringify(playlists)}` : "The listener has no playlists.",
          { playlists },
        );
      }
      const liked = await collectionSongs("liked", null, userId);
      const songs = (liked?.songs ?? []).slice(0, MAX_COLLECTION_SONGS).map(brief);
      return result(songs.length ? `${songs.length} liked songs:\n${JSON.stringify(songs)}` : "The listener hasn't liked any songs.", { songs });
    },
  );
}

module.exports = { registerTools };
