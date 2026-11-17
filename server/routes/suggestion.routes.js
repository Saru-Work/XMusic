const express = require("express");
const { get_suggestions } = require("../controllers/suggestion.controller");

const suggestion_router = express.Router();

suggestion_router.get("/", get_suggestions);

module.exports = suggestion_router;
