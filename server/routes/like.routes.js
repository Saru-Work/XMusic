const express = require("express");
const auth_middleware = require("../middleware/auth.middleware");
const {
  get_likes,
  like_song,
  unlike_song,
} = require("../controllers/like.controller");

const like_router = express.Router();

like_router.get("/", auth_middleware, get_likes);
like_router.post("/", auth_middleware, like_song);
like_router.delete("/:songId", auth_middleware, unlike_song);

module.exports = like_router;
