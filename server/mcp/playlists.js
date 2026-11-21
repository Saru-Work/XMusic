// Changes to the listener's own library made through MCP: their playlists
// and liked songs. Every write is checked against `userId`, so an app can
// only ever change the playlists of the listener who connected it.

const mongoose = require("mongoose");
const Playlist = require("../models/Playlist");
const User = require("../models/User");
const { findOrCreateYouTubeSong } = require("../youtubeSong");
const { YOUTUBE_PREFIX, toPlayerSong } = require("./library");
const { mapLimited } = require("./resolve");

/** Playlists can't grow past this through MCP */
const MAX_PLAYLIST_SONGS = 500;
const MAX_TITLE = 100;
const MAX_DESCRIPTION = 300;

/** A problem to report to the model as is (not a server error) */
class LibraryError extends Error {}

const wordsOf = (text) => String(text || "").toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

function cleanTitle(title) {
  const value = String(title || "").replace(/\s+/g, " ").trim();
  if (!value) throw new LibraryError("A playlist needs a name.");
  return value.slice(0, MAX_TITLE);
}

const cleanDescription = (text) => String(text || "").trim().slice(0, MAX_DESCRIPTION);

/** Compact playlist for tool output */
function summary(playlist) {
  return {
    id: String(playlist._id),
    title: playlist.title,
    description: playlist.description || "",
    songCount: playlist.songs.length,
  };
}

/**
 * Player songs (from resolveItems) -> saved Song ids. YouTube results are
 * stored once as artist-less songs, the same way the web app saves them.
 */
async function saveSongs(songs) {
  const saved = await mapLimited(songs, 5, async (song) => {
    if (String(song._id).startsWith(YOUTUBE_PREFIX)) {
      try {
        const doc = await findOrCreateYouTubeSong(song.youtubeId, song.duration);
        return { id: doc._id, title: doc.title };
      } catch {
        return { failed: song.title };
      }
    }
    return { id: new mongoose.Types.ObjectId(String(song._id)), title: song.title };
  });
  return {
    ids: saved.filter((s) => s.id).map((s) => s.id),
    titles: saved.filter((s) => s.id).map((s) => s.title),
    failed: saved.filter((s) => s.failed).map((s) => s.failed),
  };
}

/**
 * One of the listener's playlists, by id or by name. A name matches exactly
 * (ignoring case) or, failing that, when every word of it is in the title.
 */
async function findOwnPlaylist(userId, ref) {
  const value = String(ref || "").trim();
  if (!value) throw new LibraryError("Say which playlist (its id or name).");
  if (mongoose.isValidObjectId(value)) {
    const playlist = await Playlist.findById(value);
    if (playlist && String(playlist.user) === String(userId)) return playlist;
    if (playlist) throw new LibraryError("That playlist belongs to someone else; only your own playlists can be changed.");
  }
  const mine = await Playlist.find({ user: userId });
  const wanted = value.toLowerCase();
  const exact = mine.filter((p) => p.title.trim().toLowerCase() === wanted);
  if (exact.length === 1) return exact[0];
  const words = wordsOf(value);
  const close = exact.length
    ? exact
    : mine.filter((p) => {
        const title = wordsOf(p.title);
        return words.length > 0 && words.every((w) => title.includes(w));
      });
  if (close.length === 1) return close[0];
  if (close.length > 1) {
    throw new LibraryError(
      `More than one playlist matches "${value}": ${close.map((p) => `"${p.title}" (id ${p._id})`).join(", ")}. Use the id.`,
    );
  }
  throw new LibraryError(
    mine.length
      ? `No playlist called "${value}". Your playlists: ${mine.map((p) => `"${p.title}"`).join(", ")}.`
      : `No playlist called "${value}"; you don't have any playlists yet.`,
  );
}

async function createPlaylist(userId, { title, description, songs = [] }) {
  const name = cleanTitle(title);
  const { ids, titles, failed } = await saveSongs(songs.slice(0, MAX_PLAYLIST_SONGS));
  const unique = [...new Map(ids.map((id) => [String(id), id])).values()];
  const playlist = await Playlist.create({
    title: name,
    description: cleanDescription(description),
    user: userId,
    songs: unique,
  });
  return { playlist: summary(playlist), added: titles, failed };
}

/** Adds songs to the end, skipping ones already in it */
async function addToPlaylist(userId, ref, songs) {
  const playlist = await findOwnPlaylist(userId, ref);
  const room = MAX_PLAYLIST_SONGS - playlist.songs.length;
  if (room <= 0) throw new LibraryError(`"${playlist.title}" is full (${MAX_PLAYLIST_SONGS} songs).`);
  const { ids, titles, failed } = await saveSongs(songs.slice(0, room));
  const existing = new Set(playlist.songs.map(String));
  const added = [];
  const already = [];
  ids.forEach((id, i) => {
    if (existing.has(String(id))) return already.push(titles[i]);
    existing.add(String(id));
    added.push({ id, title: titles[i] });
  });
  if (added.length) {
    await Playlist.updateOne({ _id: playlist._id }, { $addToSet: { songs: { $each: added.map((a) => a.id) } } });
  }
  return {
    playlist: { ...summary(playlist), songCount: playlist.songs.length + added.length },
    added: added.map((a) => a.title),
    already,
    failed,
    skipped: Math.max(0, songs.length - room),
  };
}

/** A playlist's songs, in order, in the player's shape */
async function playlistSongs(playlist) {
  await playlist.populate({ path: "songs", populate: { path: "artist", select: "title isActive" } });
  return playlist.songs.filter(Boolean).map(toPlayerSong);
}

/**
 * Removes songs by id, or by a query matched against the playlist's titles
 * and artists (every word must appear).
 */
async function removeFromPlaylist(userId, ref, items) {
  const playlist = await findOwnPlaylist(userId, ref);
  const songs = await playlistSongs(playlist);
  const remove = new Map();
  const notFound = [];
  for (const item of items) {
    const id = String(item.id || "").trim();
    let matches = [];
    if (id) {
      matches = songs.filter((s) => s._id === id || (s.youtubeId && `${YOUTUBE_PREFIX}${s.youtubeId}` === id));
    } else {
      const words = wordsOf(item.query);
      matches = songs.filter((s) => {
        const artist = typeof s.artist === "object" && s.artist ? s.artist.title : "";
        const text = wordsOf(`${s.title} ${artist} ${s.channel || ""}`);
        return words.length > 0 && words.every((w) => text.some((t) => t.startsWith(w)));
      });
      // A vague query shouldn't empty the playlist
      if (matches.length > 1) {
        throw new LibraryError(
          `"${item.query}" matches ${matches.length} songs in "${playlist.title}": ${matches
            .slice(0, 10)
            .map((s) => `"${s.title}" (id ${s._id})`)
            .join(", ")}. Remove them by id.`,
        );
      }
    }
    if (!matches.length) notFound.push(item.query ?? item.id);
    for (const song of matches) remove.set(song._id, song.title);
  }
  if (remove.size) {
    await Playlist.updateOne({ _id: playlist._id }, { $pull: { songs: { $in: [...remove.keys()] } } });
  }
  return {
    playlist: { ...summary(playlist), songCount: playlist.songs.length - remove.size },
    removed: [...remove.values()],
    notFound,
  };
}

async function getPlaylist(userId, ref) {
  const playlist = await findOwnPlaylist(userId, ref);
  const songs = await playlistSongs(playlist);
  return { playlist: summary(playlist), songs };
}

async function updatePlaylist(userId, ref, { title, description }) {
  const playlist = await findOwnPlaylist(userId, ref);
  if (title != null) playlist.title = cleanTitle(title);
  if (description != null) playlist.description = cleanDescription(description);
  await playlist.save();
  return { playlist: summary(playlist) };
}

async function deletePlaylist(userId, ref) {
  const playlist = await findOwnPlaylist(userId, ref);
  await playlist.deleteOne();
  return { playlist: summary(playlist) };
}

async function likeSongs(userId, songs) {
  const { ids, titles, failed } = await saveSongs(songs);
  if (ids.length) await User.updateOne({ _id: userId }, { $addToSet: { likedSongs: { $each: ids } } });
  return { liked: titles, failed };
}

/** Unlikes by id, or by a query matched against the liked songs */
async function unlikeSongs(userId, items) {
  const user = await User.findById(userId).populate({
    path: "likedSongs",
    populate: { path: "artist", select: "title isActive" },
  });
  const liked = (user?.likedSongs ?? []).filter(Boolean).map(toPlayerSong);
  const remove = new Map();
  const notFound = [];
  for (const item of items) {
    const id = String(item.id || "").trim();
    const words = wordsOf(item.query);
    const matches = liked.filter((s) => {
      if (id) return s._id === id || (s.youtubeId && `${YOUTUBE_PREFIX}${s.youtubeId}` === id);
      const artist = typeof s.artist === "object" && s.artist ? s.artist.title : "";
      const text = wordsOf(`${s.title} ${artist} ${s.channel || ""}`);
      return words.length > 0 && words.every((w) => text.some((t) => t.startsWith(w)));
    });
    if (!id && matches.length > 1) {
      throw new LibraryError(
        `"${item.query}" matches ${matches.length} liked songs: ${matches
          .slice(0, 10)
          .map((s) => `"${s.title}" (id ${s._id})`)
          .join(", ")}. Unlike them by id.`,
      );
    }
    if (!matches.length) notFound.push(item.query ?? item.id);
    for (const song of matches) remove.set(song._id, song.title);
  }
  if (remove.size) await User.updateOne({ _id: userId }, { $pull: { likedSongs: { $in: [...remove.keys()] } } });
  return { unliked: [...remove.values()], notFound };
}

module.exports = {
  LibraryError,
  MAX_PLAYLIST_SONGS,
  createPlaylist,
  addToPlaylist,
  removeFromPlaylist,
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  likeSongs,
  unlikeSongs,
};
