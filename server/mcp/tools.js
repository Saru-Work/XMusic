// The tools ChatGPT (or any MCP client) can call. Each MCP request builds
// these for one listener (`userId`); they find music in the catalog and send
// it to that listener's open XMusic tab through the remote-control hub.

const { z } = require("zod");
const { validateCommand } = require("../realtime/commands");
const { pickDevice, sendCommand, notifyLibraryChanged, RemoteError } = require("../realtime/hub");
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
const library = require("./playlists");

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

/** Answers where the songs are loaded but not audible yet */
const HELD = ["autoplay_blocked", "waiting_for_tab"];

/** `held`: loaded, but the browser hasn't let it start yet */
function describeNowPlaying(now, { held = false } = {}) {
  if (!now?.song) return "Nothing is loaded in the player.";
  const by = now.song.artist ? ` by ${now.song.artist}` : "";
  const state = held ? "Ready to play" : now.isPlaying ? "Now playing" : "Paused on";
  const lines = [`${state} "${now.song.title}"${by} (song ${now.position} of ${now.queueLength}).`];
  if (now.upNext?.length) lines.push(`Up next: ${now.upNext.map((t) => `"${t}"`).join(", ")}.`);
  lines.push(`Shuffle ${now.shuffle ? "on" : "off"}, repeat ${now.repeat}.`);
  return lines.join(" ");
}

/** What to tell ChatGPT when the tab answered but something didn't work */
function explainProblem(answer) {
  if (answer.reason === "waiting_for_tab") {
    return "The songs are loaded, but the browser won't start them while the XMusic tab is in the background. Tell the user to switch to the XMusic tab: playback starts by itself as soon as they do (no click needed).";
  }
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

/** "a", "b" and 3 more */
function titles(list, max = 5) {
  const shown = list.slice(0, max).map((t) => `"${t}"`).join(", ");
  return list.length > max ? `${shown} and ${list.length - max} more` : shown;
}

const missingText = (missing) =>
  missing.length ? ` Couldn't find: ${missing.map((m) => JSON.stringify(m.item.query ?? m.item.id)).join(", ")}.` : "";

/** Runs a library change; problems the listener should hear about become tool errors */
async function libraryCall(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof library.LibraryError) return failure(err.message);
    throw err;
  }
}

function playResult(answer, { intro, missing = [] }) {
  const parts = [intro];
  if (!answer.ok) parts.push(explainProblem(answer));
  parts.push(describeNowPlaying(answer.nowPlaying, { held: HELD.includes(answer.reason) }));
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

const songItem = z
  .object({
    id: z.string().nullish().describe("A song id from search_music, get_playlist or get_now_playing (library id or yt:<videoId>)."),
    query: z.string().max(200).nullish().describe('Song to look up, best as "Title Artist", or a YouTube link.'),
  })
  .refine((item) => item.id || item.query, "Each item needs an id or a query");
const songItems = z.array(songItem);

const playlistRef = z
  .string()
  .min(1)
  .max(200)
  .describe("One of the listener's playlists: its id (from list_my_library) or its name.");

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
const playerChange = { readOnlyHint: false, destructiveHint: false, idempotentHint: false };
const libraryChange = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const libraryRemove = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

// ---- tools ---------------------------------------------------------------

/** The scope a token needs for each tool */
const TOOL_SCOPES = {
  search_music: "music:read",
  get_now_playing: "music:read",
  list_my_library: "music:read",
  play: "player:control",
  play_collection: "player:control",
  control_playback: "player:control",
  create_playlist: "library:write",
  add_to_playlist: "library:write",
  remove_from_playlist: "library:write",
  update_playlist: "library:write",
  delete_playlist: "library:write",
  like_songs: "library:write",
  unlike_songs: "library:write",
  // Reading one of your own playlists is only useful for changing it
  get_playlist: "library:write",
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
        items: songItems.min(1).max(MAX_PLAY_ITEMS),
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
      const held = HELD.includes(answer.reason);
      const text = answer.ok
        ? describeNowPlaying(answer.nowPlaying)
        : `${explainProblem(answer)} ${describeNowPlaying(answer.nowPlaying, { held })}`;
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

  // ---- the listener's own library (playlists, liked songs) ----------------

  const changed = (change) => notifyLibraryChanged(userId, change);
  const canPlay = scopes.includes(TOOL_SCOPES.play);

  register(
    "create_playlist",
    {
      title: "Create a playlist",
      description:
        "Create a new playlist in the listener's XMusic library, optionally filled with songs right away. " +
        'Songs are given like in `play` (ids from search_music, or queries like "Title Artist"; YouTube results are saved too). ' +
        'For a request like "make me a workout playlist", pick 15-30 fitting songs yourself and pass them as queries. ' +
        "Set `play` to also start it in the listener's XMusic tab.",
      inputSchema: {
        title: z.string().min(1).max(100).describe("The playlist's name."),
        description: z.string().max(300).nullish().describe("A short description shown on the playlist page."),
        items: songItems.max(MAX_PLAY_ITEMS).nullish().describe("Songs to put in it, in order."),
        play: z.boolean().nullish().describe("Also start playing it now (default false)."),
        shuffle,
      },
      annotations: { ...libraryChange, openWorldHint: true },
    },
    async ({ title, description, items, play, shuffle: shuffleOn }) =>
      libraryCall(async () => {
        const { songs, missing } = items?.length ? await resolveItems(items) : { songs: [], missing: [] };
        const made = await library.createPlaylist(userId, { title, description, songs });
        changed({ kind: "playlists", playlistId: made.playlist.id });
        const parts = [
          `Created the playlist "${made.playlist.title}" (id ${made.playlist.id}) with ${made.playlist.songCount} song${made.playlist.songCount === 1 ? "" : "s"}.`,
        ];
        if (made.failed.length) parts.push(`Couldn't save: ${titles(made.failed)}.`);
        const data = { playlist: made.playlist, ...(missing.length && { missing: missing.map((m) => ({ ...m.item, reason: m.reason })) }) };

        if (play && songs.length) {
          if (!canPlay) {
            parts.push("It can't be started from here: this app isn't allowed to control playback.");
          } else {
            const { answer, error } = await send(userId, { type: "play", songs, mode: "replace", shuffle: shuffleOn ?? undefined });
            if (error) parts.push(`It wasn't started: ${error.content[0].text}`);
            else {
              if (!answer.ok) parts.push(explainProblem(answer));
              parts.push(describeNowPlaying(answer.nowPlaying, { held: HELD.includes(answer.reason) }));
              data.nowPlaying = answer.nowPlaying;
            }
          }
        }
        return result(parts.join(" ") + missingText(missing), data);
      }),
  );

  register(
    "add_to_playlist",
    {
      title: "Add songs to a playlist",
      description:
        "Add songs to the end of one of the listener's playlists (songs already in it are skipped). " +
        "Songs are given like in `play`. To add what's playing now, pass the song id from get_now_playing.",
      inputSchema: {
        playlist: playlistRef,
        items: songItems.min(1).max(MAX_PLAY_ITEMS),
      },
      annotations: { ...libraryChange, openWorldHint: true },
    },
    async ({ playlist, items }) =>
      libraryCall(async () => {
        const { songs, missing } = await resolveItems(items);
        if (!songs.length) {
          return failure(`None of the songs could be found: ${missing.map((m) => `${JSON.stringify(m.item.query ?? m.item.id)} (${m.reason})`).join(", ")}.`);
        }
        const done = await library.addToPlaylist(userId, playlist, songs);
        if (done.added.length) changed({ kind: "playlists", playlistId: done.playlist.id });
        const parts = [
          done.added.length
            ? `Added ${titles(done.added)} to "${done.playlist.title}" (now ${done.playlist.songCount} songs).`
            : `Nothing new was added to "${done.playlist.title}".`,
        ];
        if (done.already.length) parts.push(`Already in it: ${titles(done.already)}.`);
        if (done.failed.length) parts.push(`Couldn't save: ${titles(done.failed)}.`);
        if (done.skipped) parts.push(`${done.skipped} songs didn't fit (playlists hold up to ${library.MAX_PLAYLIST_SONGS}).`);
        return result(parts.join(" ") + missingText(missing), {
          playlist: done.playlist,
          added: done.added,
          alreadyInPlaylist: done.already,
        });
      }),
  );

  register(
    "remove_from_playlist",
    {
      title: "Remove songs from a playlist",
      description:
        "Remove songs from one of the listener's playlists, by song id (from get_playlist) or by a query matched against the playlist's song titles and artists. " +
        "A query that matches several songs removes nothing and lists them, so you can pick by id.",
      inputSchema: {
        playlist: playlistRef,
        items: songItems.min(1).max(MAX_PLAY_ITEMS),
      },
      annotations: libraryRemove,
    },
    async ({ playlist, items }) =>
      libraryCall(async () => {
        const done = await library.removeFromPlaylist(userId, playlist, items);
        if (done.removed.length) changed({ kind: "playlists", playlistId: done.playlist.id });
        const parts = [
          done.removed.length
            ? `Removed ${titles(done.removed)} from "${done.playlist.title}" (${done.playlist.songCount} songs left).`
            : `Nothing was removed from "${done.playlist.title}".`,
        ];
        if (done.notFound.length) parts.push(`Not in the playlist: ${done.notFound.map((q) => JSON.stringify(q)).join(", ")}.`);
        return result(parts.join(" "), done);
      }),
  );

  register(
    "get_playlist",
    {
      title: "Show a playlist",
      description: "The songs in one of the listener's own playlists, in order, with ids for remove_from_playlist or play.",
      inputSchema: { playlist: playlistRef },
      annotations: { ...readOnly, openWorldHint: false },
    },
    async ({ playlist }) =>
      libraryCall(async () => {
        const found = await library.getPlaylist(userId, playlist);
        const songs = found.songs.slice(0, MAX_COLLECTION_SONGS * 5).map(brief);
        const head = `"${found.playlist.title}" (id ${found.playlist.id}) has ${songs.length} song${songs.length === 1 ? "" : "s"}.`;
        return result(songs.length ? `${head}\n${JSON.stringify(songs)}` : head, { playlist: found.playlist, songs });
      }),
  );

  register(
    "update_playlist",
    {
      title: "Rename a playlist",
      description: "Rename one of the listener's playlists and/or change its description.",
      inputSchema: {
        playlist: playlistRef,
        title: z.string().min(1).max(100).nullish().describe("The new name; leave out to keep it."),
        description: z.string().max(300).nullish().describe("The new description; an empty string clears it; leave out to keep it."),
      },
      annotations: { ...libraryChange, idempotentHint: true },
    },
    async ({ playlist, title, description }) =>
      libraryCall(async () => {
        if (title == null && description == null) return failure("Give a new title or description.");
        const done = await library.updatePlaylist(userId, playlist, { title, description });
        changed({ kind: "playlists", playlistId: done.playlist.id });
        return result(`Updated the playlist "${done.playlist.title}".`, done);
      }),
  );

  register(
    "delete_playlist",
    {
      title: "Delete a playlist",
      description:
        "Permanently delete one of the listener's playlists (the songs themselves stay in XMusic). Only do this when the listener clearly asked for it.",
      inputSchema: { playlist: playlistRef },
      annotations: libraryRemove,
    },
    async ({ playlist }) =>
      libraryCall(async () => {
        const done = await library.deletePlaylist(userId, playlist);
        changed({ kind: "playlists", playlistId: done.playlist.id, deleted: true });
        return result(`Deleted the playlist "${done.playlist.title}" (${done.playlist.songCount} songs).`, done);
      }),
  );

  register(
    "like_songs",
    {
      title: "Like songs",
      description:
        "Add songs to the listener's liked songs. Songs are given like in `play`; to like what's playing now, pass the song id from get_now_playing.",
      inputSchema: { items: songItems.min(1).max(MAX_PLAY_ITEMS) },
      annotations: { ...libraryChange, idempotentHint: true, openWorldHint: true },
    },
    async ({ items }) =>
      libraryCall(async () => {
        const { songs, missing } = await resolveItems(items);
        if (!songs.length) return failure(`None of the songs could be found.${missingText(missing)}`);
        const done = await library.likeSongs(userId, songs);
        if (done.liked.length) changed({ kind: "likes" });
        const parts = [done.liked.length ? `Liked ${titles(done.liked)}.` : "Nothing was liked."];
        if (done.failed.length) parts.push(`Couldn't save: ${titles(done.failed)}.`);
        return result(parts.join(" ") + missingText(missing), done);
      }),
  );

  register(
    "unlike_songs",
    {
      title: "Unlike songs",
      description:
        "Remove songs from the listener's liked songs, by id (from list_my_library) or by a query matched against the liked songs' titles and artists.",
      inputSchema: { items: songItems.min(1).max(MAX_PLAY_ITEMS) },
      annotations: libraryRemove,
    },
    async ({ items }) =>
      libraryCall(async () => {
        const done = await library.unlikeSongs(userId, items);
        if (done.unliked.length) changed({ kind: "likes" });
        const parts = [done.unliked.length ? `Removed ${titles(done.unliked)} from liked songs.` : "Nothing was unliked."];
        if (done.notFound.length) parts.push(`Not in liked songs: ${done.notFound.map((q) => JSON.stringify(q)).join(", ")}.`);
        return result(parts.join(" "), done);
      }),
  );
}

module.exports = { registerTools };
