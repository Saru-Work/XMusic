// Read-only queries over the XMusic catalog for the MCP tools. Songs come
// back in the shape the browser player expects (client SongType).

const mongoose = require("mongoose");
const Song = require("../models/Song");
const Album = require("../models/Album");
const Artist = require("../models/Artist");
const Playlist = require("../models/Playlist");
const User = require("../models/User");

const YOUTUBE_PREFIX = "yt:";

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordsOf = (text) => String(text || "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);

/** A Song document (artist populated or not) -> the player's SongType */
function toPlayerSong(song) {
  const artist =
    song.artist && typeof song.artist === "object" && song.artist.title
      ? { _id: String(song.artist._id), title: song.artist.title }
      : song.artist
        ? String(song.artist._id ?? song.artist)
        : null;
  return {
    _id: String(song._id),
    title: song.title,
    url: song.url,
    duration: song.duration || 0,
    artist,
    ...(song.album && { album: String(song.album._id ?? song.album) }),
    source: song.source || "upload",
    ...(song.youtubeId && { youtubeId: song.youtubeId }),
    ...(song.channel && { channel: song.channel }),
  };
}

/** A YouTube search result -> SongType (same as the client's youtubeResultToSong) */
function youtubeToPlayerSong(result) {
  return {
    _id: `${YOUTUBE_PREFIX}${result.videoId}`,
    title: result.title,
    url: `https://www.youtube.com/watch?v=${result.videoId}`,
    duration: result.duration || 0,
    artist: null,
    source: "youtube",
    youtubeId: result.videoId,
    channel: result.channel,
  };
}

/** Songs a listener may play: not from a deactivated artist */
function playable(song) {
  if (!song) return false;
  if (song.artist && typeof song.artist === "object" && "isActive" in song.artist) {
    return song.artist.isActive !== false;
  }
  // Artist missing: only YouTube songs saved without an XMusic artist are fine
  return !song.artist && song.source === "youtube";
}

async function activeArtistIds() {
  return (await Artist.find({ isActive: true }).select("_id")).map((a) => a._id);
}

/**
 * Library songs where every word appears in the title, the artist name or
 * the YouTube channel. Exact title matches first.
 */
async function searchSongs(query, limit = 10) {
  const words = wordsOf(query);
  if (!words.length) return [];
  const conditions = await Promise.all(
    words.map(async (word) => {
      const regex = new RegExp(escapeRegex(word), "i");
      const artists = await Artist.find({ title: regex, isActive: true }).select("_id");
      return {
        $or: [{ title: regex }, { channel: regex }, { artist: { $in: artists.map((a) => a._id) } }],
      };
    }),
  );
  const songs = await Song.find({ $and: conditions })
    .limit(limit * 3)
    .populate("artist", "title isActive");
  const wanted = String(query).trim().toLowerCase();
  return songs
    .filter(playable)
    .sort(
      (a, b) =>
        Number(b.title.toLowerCase() === wanted) - Number(a.title.toLowerCase() === wanted) ||
        a.title.length - b.title.length,
    )
    .slice(0, limit)
    .map(toPlayerSong);
}

async function searchCollections(query, limit = 5) {
  const words = wordsOf(query);
  if (!words.length) return { albums: [], artists: [], playlists: [] };
  const all = (field) => ({ $and: words.map((w) => ({ [field]: new RegExp(escapeRegex(w), "i") })) });
  const active = await activeArtistIds();
  const [albums, artists, playlists] = await Promise.all([
    Album.find({ ...all("title"), artist: { $in: active } }).limit(limit).populate("artist", "title"),
    Artist.find({ ...all("title"), isActive: true }).limit(limit),
    Playlist.find({ ...all("title"), "songs.0": { $exists: true } }).limit(limit),
  ]);
  return {
    albums: albums.map((a) => ({ id: String(a._id), title: a.title, artist: a.artist?.title ?? null, songCount: a.songs.length })),
    artists: artists.map((a) => ({ id: String(a._id), name: a.title })),
    playlists: playlists.map((p) => ({ id: String(p._id), title: p.title, songCount: p.songs.length })),
  };
}

/** One library song by id, or null if missing / not playable */
async function getSong(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const song = await Song.findById(id).populate("artist", "title isActive");
  return playable(song) ? toPlayerSong(song) : null;
}

const populateSongs = { path: "songs", populate: { path: "artist", select: "title isActive" } };

/**
 * Songs of a playlist / album / artist / the listener's liked songs.
 * Returns { title, songs } or null when not found.
 */
async function collectionSongs(type, id, userId) {
  if (type === "liked") {
    const user = await User.findById(userId).populate({
      path: "likedSongs",
      populate: { path: "artist", select: "title isActive" },
    });
    if (!user) return null;
    return { title: "Liked songs", songs: user.likedSongs.filter(playable).map(toPlayerSong) };
  }
  if (!mongoose.isValidObjectId(id)) return null;
  if (type === "playlist") {
    const playlist = await Playlist.findById(id).populate(populateSongs);
    if (!playlist) return null;
    return { title: playlist.title, songs: playlist.songs.filter(playable).map(toPlayerSong) };
  }
  if (type === "album") {
    const album = await Album.findById(id).populate("artist", "title isActive");
    if (!album || album.artist?.isActive === false) return null;
    const songs = await Song.find({ album: id }).populate("artist", "title isActive");
    return { title: album.title, songs: songs.filter(playable).map(toPlayerSong) };
  }
  if (type === "artist") {
    const artist = await Artist.findById(id);
    if (!artist || !artist.isActive) return null;
    const songs = await Song.find({ artist: id }).populate("artist", "title isActive");
    return { title: artist.title, songs: songs.map(toPlayerSong) };
  }
  return null;
}

async function listPlaylists(userId) {
  const playlists = await Playlist.find({ user: userId });
  return playlists.map((p) => ({ id: String(p._id), title: p.title, songCount: p.songs.length }));
}

module.exports = {
  YOUTUBE_PREFIX,
  playable,
  toPlayerSong,
  youtubeToPlayerSong,
  searchSongs,
  searchCollections,
  getSong,
  collectionSongs,
  listPlaylists,
};
