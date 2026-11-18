// Remote control: lets the server tell a listener's open XMusic tab what to play.
//
// Every logged-in tab opens a Socket.IO connection (authenticated with the
// same `access_token` cookie as the REST API) and joins the room
// `user:<id>`. Tabs report who they are and what they're playing; the server
// sends commands to the tab the listener used most recently and waits for
// its answer.

const { Server } = require("socket.io");
const { parse: parseCookie } = require("cookie");
const User = require("../models/User");
const { verifyToken } = require("../utils/jwt.util");

const COMMAND_TIMEOUT_MS = 5000;

/** userId -> Map(socketId -> device) */
const devices = new Map();
let io = null;

class RemoteError extends Error {
  /** code: "no_device" | "timeout" */
  constructor(code, message) {
    super(message);
    this.code = code;
    this.status = code === "no_device" ? 409 : 504;
  }
}

function userDevices(userId) {
  let map = devices.get(userId);
  if (!map) {
    map = new Map();
    devices.set(userId, map);
  }
  return map;
}

/** What we tell callers about a tab (no socket internals) */
function publicDevice(device) {
  return {
    id: device.id,
    label: device.label,
    connectedAt: device.connectedAt,
    lastInteraction: device.lastInteraction,
    canAutoplay: device.canAutoplay,
    nowPlaying: device.nowPlaying,
  };
}

function cleanState(state, device) {
  if (!state || typeof state !== "object") return;
  if (typeof state.label === "string") device.label = state.label.slice(0, 80);
  if (typeof state.canAutoplay === "boolean") device.canAutoplay = state.canAutoplay;
  const interaction = Number(state.lastInteraction);
  if (interaction > 0) device.lastInteraction = Math.min(interaction, Date.now());
  if (state.nowPlaying && typeof state.nowPlaying === "object") {
    device.nowPlaying = state.nowPlaying;
  }
}

async function authenticate(socket, next) {
  try {
    const cookies = parseCookie(socket.handshake.headers.cookie ?? "");
    const token = cookies.access_token;
    if (!token) return next(new Error("Unauthorized"));
    const { sub } = verifyToken(token);
    const user = await User.exists({ _id: sub });
    if (!user) return next(new Error("Unauthorized"));
    socket.data.userId = String(sub);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
}

function attachHub(httpServer, { clientUrl }) {
  io = new Server(httpServer, {
    cors: { origin: clientUrl, credentials: true },
  });
  io.use(authenticate);

  io.on("connection", (socket) => {
    const { userId } = socket.data;
    const device = {
      id: socket.id,
      socket,
      label: "Browser",
      connectedAt: Date.now(),
      lastInteraction: 0,
      canAutoplay: false,
      nowPlaying: null,
    };
    userDevices(userId).set(socket.id, device);
    socket.join(`user:${userId}`);

    socket.on("device:state", (state) => cleanState(state, device));

    socket.on("disconnect", () => {
      const map = devices.get(userId);
      map?.delete(socket.id);
      if (map && map.size === 0) devices.delete(userId);
    });
  });

  return io;
}

function listDevices(userId) {
  return [...(devices.get(String(userId))?.values() ?? [])].map(publicDevice);
}

/** The tab the listener touched last (newest connection breaks ties) */
function pickDevice(userId) {
  let best = null;
  for (const device of devices.get(String(userId))?.values() ?? []) {
    if (
      !best ||
      device.lastInteraction > best.lastInteraction ||
      (device.lastInteraction === best.lastInteraction && device.connectedAt > best.connectedAt)
    ) {
      best = device;
    }
  }
  return best;
}

/**
 * Sends an already-validated command to the listener's active tab and
 * resolves with the tab's answer: { ok, reason?, message?, nowPlaying, device }.
 * Throws RemoteError when no tab is open or it doesn't answer in time.
 */
async function sendCommand(userId, command, { timeoutMs = COMMAND_TIMEOUT_MS } = {}) {
  const device = pickDevice(userId);
  if (!device) {
    throw new RemoteError("no_device", "No XMusic tab is open. Open XMusic in your browser and log in.");
  }
  let answer;
  try {
    answer = await device.socket.timeout(timeoutMs).emitWithAck("command", command);
  } catch {
    throw new RemoteError("timeout", "Your XMusic tab didn't respond. Is it still open?");
  }
  if (answer?.nowPlaying) device.nowPlaying = answer.nowPlaying;
  return {
    ok: answer?.ok === true,
    ...(answer?.reason && { reason: String(answer.reason) }),
    ...(answer?.message && { message: String(answer.message) }),
    nowPlaying: device.nowPlaying,
    device: publicDevice(device),
  };
}

module.exports = { attachHub, listDevices, pickDevice, sendCommand, RemoteError };
