const express = require("express");
const auth_middleware = require("../middleware/auth.middleware");
const { validateCommand } = require("../realtime/commands");
const { listDevices, sendCommand, RemoteError } = require("../realtime/hub");

// Control your own open XMusic tabs. Used by scripts/remote.js today and by
// the ChatGPT MCP server later.
const remote_router = express.Router();

// GET /remote/devices -> { devices: [{ id, label, lastInteraction, canAutoplay, nowPlaying }] }
remote_router.get("/devices", auth_middleware, (req, res) => {
  return res.json({ devices: listDevices(req.user._id) });
});

// POST /remote/command  { type: "play", songs, mode?, shuffle? } | { type: "control", action, value? }
//   -> { ok, reason?, message?, nowPlaying, device }
remote_router.post("/command", auth_middleware, async (req, res) => {
  let command;
  try {
    command = validateCommand(req.body);
  } catch (err) {
    return res.status(err.status || 400).json({ message: err.message });
  }
  try {
    return res.json(await sendCommand(req.user._id, command));
  } catch (err) {
    if (err instanceof RemoteError) {
      return res.status(err.status).json({ message: err.message, reason: err.code });
    }
    console.error(err);
    return res.status(500).json({ message: "Server Error!" });
  }
});

module.exports = remote_router;
