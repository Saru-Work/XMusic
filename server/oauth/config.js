// Shared OAuth settings: where XMusic lives, what can be granted, and the
// helpers for tokens and secrets.

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

/** What an app can be allowed to do, with the wording shown to listeners */
const SCOPES = {
  "music:read": "Search your music, playlists and liked songs, and see what's playing",
  "player:control": "Play, pause and skip songs in your open XMusic tab",
  "library:write": "Create and change your playlists and liked songs",
};
const ALL_SCOPES = Object.keys(SCOPES);

const ACCESS_TOKEN_SECONDS = 60 * 60; // 1 hour
const REFRESH_TOKEN_DAYS = 30;
const CODE_SECONDS = 60;

const trimSlash = (url) => url.replace(/\/+$/, "");

/** This server's public base URL (the domain ChatGPT reaches) */
function issuer() {
  return trimSlash(
    process.env.PUBLIC_URL || process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`,
  );
}

/** The protected resource: the MCP endpoint */
const resourceUrl = () => `${issuer()}/mcp`;

/** Where the XMusic web app runs (the /connect approval page lives there) */
const clientUrl = () => trimSlash(process.env.CLIENT_URL || "http://localhost:5173");

/** Random URL-safe token */
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

/** Constant-time compare of two strings */
function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** PKCE S256: base64url(sha256(verifier)) */
const pkceChallenge = (verifier) => crypto.createHash("sha256").update(verifier).digest("base64url");

/**
 * Access tokens get their own key (derived from JWT_SECRET), so they can't be
 * passed off as login cookies, and login cookies can't be used on /mcp.
 */
function accessKey() {
  return crypto.createHmac("sha256", process.env.JWT_SECRET).update("xmusic:oauth:access-token").digest();
}

function signAccessToken({ userId, grantId, clientId, scope, resource }) {
  return jwt.sign({ scope, gid: String(grantId), cid: clientId }, accessKey(), {
    subject: String(userId),
    audience: resource,
    issuer: issuer(),
    expiresIn: ACCESS_TOKEN_SECONDS,
  });
}

/** -> payload, or throws */
function verifyAccessToken(token, resource) {
  return jwt.verify(token, accessKey(), { audience: resource, issuer: issuer() });
}

/** Keep only scopes we know; none asked for means all of them */
function normalizeScope(requested) {
  const asked = String(requested || "").split(/\s+/).filter(Boolean);
  if (!asked.length) return ALL_SCOPES.join(" ");
  const known = asked.filter((s) => ALL_SCOPES.includes(s));
  return known.length ? [...new Set(known)].join(" ") : null;
}

module.exports = {
  SCOPES,
  ALL_SCOPES,
  ACCESS_TOKEN_SECONDS,
  REFRESH_TOKEN_DAYS,
  CODE_SECONDS,
  issuer,
  resourceUrl,
  clientUrl,
  randomToken,
  sha256,
  safeEqual,
  pkceChallenge,
  signAccessToken,
  verifyAccessToken,
  normalizeScope,
};
