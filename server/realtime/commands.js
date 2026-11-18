// Shape checks for remote-control commands sent to a listener's browser.
// Returns the cleaned command, or throws an Error with `status = 400`.

const PLAY_MODES = ["replace", "next", "append"];
const CONTROL_ACTIONS = ["pause", "resume", "toggle", "next", "previous", "shuffle", "repeat"];
const REPEAT_MODES = ["off", "all", "one"];
const MAX_SONGS = 100;

function invalid(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

const isText = (value) => typeof value === "string" && value.length > 0;

/** Keep only the song fields the player uses */
function cleanSong(song, i) {
  if (!song || typeof song !== "object") throw invalid(`songs[${i}] must be an object`);
  if (!isText(song._id) || !isText(song.title) || !isText(song.url)) {
    throw invalid(`songs[${i}] needs _id, title and url`);
  }
  const source = song.source === "youtube" ? "youtube" : "upload";
  if (source === "youtube" && !isText(song.youtubeId)) {
    throw invalid(`songs[${i}] is a YouTube song without youtubeId`);
  }
  const artist =
    song.artist && typeof song.artist === "object"
      ? { _id: String(song.artist._id ?? ""), title: String(song.artist.title ?? "") }
      : typeof song.artist === "string"
        ? song.artist
        : null;
  return {
    _id: song._id,
    title: song.title,
    url: song.url,
    duration: Number(song.duration) || 0,
    artist,
    ...(isText(song.album) && { album: song.album }),
    source,
    ...(source === "youtube" && { youtubeId: song.youtubeId }),
    ...(isText(song.channel) && { channel: song.channel }),
  };
}

function validateCommand(body) {
  if (!body || typeof body !== "object") throw invalid("Command must be an object");
  const from = isText(body.from) ? body.from.slice(0, 40) : "Remote";

  if (body.type === "play") {
    if (!Array.isArray(body.songs) || body.songs.length === 0) {
      throw invalid("play needs a non-empty songs array");
    }
    if (body.songs.length > MAX_SONGS) throw invalid(`play takes at most ${MAX_SONGS} songs`);
    const mode = body.mode ?? "replace";
    if (!PLAY_MODES.includes(mode)) throw invalid(`mode must be one of ${PLAY_MODES.join(", ")}`);
    if (body.shuffle !== undefined && typeof body.shuffle !== "boolean") {
      throw invalid("shuffle must be true or false");
    }
    return { type: "play", from, songs: body.songs.map(cleanSong), mode, shuffle: body.shuffle };
  }

  if (body.type === "control") {
    const { action, value } = body;
    if (!CONTROL_ACTIONS.includes(action)) {
      throw invalid(`action must be one of ${CONTROL_ACTIONS.join(", ")}`);
    }
    if (action === "shuffle" && typeof value !== "boolean") {
      throw invalid("shuffle needs value true or false");
    }
    if (action === "repeat" && !REPEAT_MODES.includes(value)) {
      throw invalid(`repeat needs value ${REPEAT_MODES.join(", ")}`);
    }
    return {
      type: "control",
      from,
      action,
      ...((action === "shuffle" || action === "repeat") && { value }),
    };
  }

  throw invalid('type must be "play" or "control"');
}

module.exports = { validateCommand };
