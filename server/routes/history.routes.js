const express = require("express");
const auth_middleware = require("../middleware/auth.middleware");
const {
  report_play,
  get_history,
  clear_history,
} = require("../controllers/history.controller");

const history_router = express.Router();

history_router.get("/", auth_middleware, get_history);
history_router.put("/plays/:playId", auth_middleware, report_play);
history_router.delete("/", auth_middleware, clear_history);

module.exports = history_router;
