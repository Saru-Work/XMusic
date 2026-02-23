const {
  login,
  register,
  check_auth,
  get_profile,
  logout,
} = require("../controllers/auth.controller");
const express = require("express");
const auth_middleware = require("../middleware/auth.middleware");

const auth_router = new express.Router();

auth_router.post("/login", login);
auth_router.post("/register", register);
auth_router.get("/checkAuth", check_auth);
auth_router.get("/profile", auth_middleware, get_profile);
auth_router.post("/logout", auth_middleware, logout);
module.exports = auth_router;
