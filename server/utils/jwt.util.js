const jwt = require("jsonwebtoken");

/** How long a login lasts: the cookie and the token inside it expire together */
const LOGIN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateToken(user) {
  return jwt.sign({ sub: user._id }, process.env.JWT_SECRET, {
    expiresIn: LOGIN_TTL_MS / 1000,
  });
}
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { generateToken, verifyToken, LOGIN_TTL_MS };
