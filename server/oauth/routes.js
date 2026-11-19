// The OAuth 2.1 authorization server that lets ChatGPT act for a listener.
//
//   POST /oauth/register                  dynamic client registration (RFC 7591)
//   GET  /oauth/authorize                 checks the request, sends the browser to /connect
//   GET  /oauth/requests/:id              what the /connect page shows
//   POST /oauth/requests/:id/decision     Allow / Deny (logged-in listener)
//   POST /oauth/token                     code -> tokens, refresh -> new tokens
//   POST /oauth/revoke                    RFC 7009
//   GET  /oauth/grants, DELETE /:id       the listener's Connected apps

const express = require("express");
const mongoose = require("mongoose");
const auth_middleware = require("../middleware/auth.middleware");
const OAuthClient = require("../models/OAuthClient");
const OAuthRequest = require("../models/OAuthRequest");
const OAuthCode = require("../models/OAuthCode");
const OAuthGrant = require("../models/OAuthGrant");
const { rateLimit } = require("./rateLimit");
const {
  SCOPES,
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
} = require("./config");

const AUTH_METHODS = ["none", "client_secret_post", "client_secret_basic"];
const GRANT_TYPES = ["authorization_code", "refresh_token"];
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

// ---- helpers ---------------------------------------------------------------

function oauthError(res, status, error, description) {
  res.set("Cache-Control", "no-store");
  return res.status(status).json({ error, ...(description && { error_description: description }) });
}

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** For errors we can't send back to the app (unknown app / redirect URL) */
function errorPage(res, message) {
  return res
    .status(400)
    .type("html")
    .send(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>XMusic</title><body style="font-family:system-ui;background:#000;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0">` +
        `<main style="max-width:28rem;padding:1.5rem"><h1 style="font-size:1.25rem">Couldn't connect to XMusic</h1>` +
        `<p style="color:#aaa">${escapeHtml(message)}</p></main></body>`,
    );
}

/** redirect_uri + query params (code / error, state, iss) */
function withParams(uri, params) {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }
  return url.toString();
}

function validRedirectUri(value) {
  if (typeof value !== "string" || value.length > 2000) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname);
}

/** client_id (+ secret) from the body or a Basic header -> client, or null */
async function authenticateClient(req) {
  let id = req.body?.client_id;
  let secret = req.body?.client_secret;
  const header = req.headers.authorization || "";
  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString();
    const colon = decoded.indexOf(":");
    if (colon > 0) {
      id = decodeURIComponent(decoded.slice(0, colon));
      secret = decodeURIComponent(decoded.slice(colon + 1));
    }
  }
  if (typeof id !== "string" || !id) return null;
  const client = await OAuthClient.findOne({ clientId: id });
  if (!client) return null;
  if (client.authMethod !== "none") {
    if (typeof secret !== "string" || !safeEqual(sha256(secret), client.clientSecretHash)) return null;
  }
  return client;
}

/** New refresh token on the grant + a new access token */
async function issueTokens(res, grant) {
  const refreshToken = randomToken(32);
  grant.refreshHash = sha256(refreshToken);
  grant.refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  grant.lastUsedAt = new Date();
  await grant.save();
  const accessToken = signAccessToken({
    userId: grant.user,
    grantId: grant._id,
    clientId: grant.clientId,
    scope: grant.scope,
    resource: grant.resource,
  });
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  return res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_SECONDS,
    refresh_token: refreshToken,
    scope: grant.scope,
  });
}

// ---- router ----------------------------------------------------------------

function createOAuthRouter({ authMiddleware = auth_middleware } = {}) {
  const router = express.Router();
  router.use(express.urlencoded({ extended: false, limit: "20kb" }));
  const strict = rateLimit({ limit: 20, windowMs: 60 * 1000 });
  const tokenLimit = rateLimit({ limit: 60, windowMs: 60 * 1000 });

  // Requests from the XMusic web app must come from the web app's origin
  const sameSite = (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin !== clientUrl()) return res.status(403).json({ message: "Forbidden" });
    next();
  };

  router.post("/register", strict, async (req, res) => {
    const body = req.body || {};
    const uris = body.redirect_uris;
    if (!Array.isArray(uris) || uris.length === 0 || uris.length > 10 || !uris.every(validRedirectUri)) {
      return oauthError(res, 400, "invalid_redirect_uri", "redirect_uris must be https URLs (or http on localhost).");
    }
    const authMethod = body.token_endpoint_auth_method || "none";
    if (!AUTH_METHODS.includes(authMethod)) {
      return oauthError(res, 400, "invalid_client_metadata", `token_endpoint_auth_method must be one of ${AUTH_METHODS.join(", ")}.`);
    }
    if (body.grant_types && !(Array.isArray(body.grant_types) && body.grant_types.every((g) => GRANT_TYPES.includes(g)))) {
      return oauthError(res, 400, "invalid_client_metadata", "Unsupported grant_types.");
    }
    if (body.response_types && !(Array.isArray(body.response_types) && body.response_types.every((r) => r === "code"))) {
      return oauthError(res, 400, "invalid_client_metadata", 'Only response_types ["code"] is supported.');
    }
    const clientId = randomToken(18);
    const secret = authMethod === "none" ? null : randomToken(32);
    const clientName = String(body.client_name || "An app").slice(0, 80);
    try {
      await OAuthClient.create({
        clientId,
        clientSecretHash: secret ? sha256(secret) : undefined,
        authMethod,
        clientName,
        redirectUris: uris,
      });
    } catch (err) {
      console.error(err);
      return oauthError(res, 500, "server_error");
    }
    res.set("Cache-Control", "no-store");
    return res.status(201).json({
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName,
      redirect_uris: uris,
      grant_types: GRANT_TYPES,
      response_types: ["code"],
      token_endpoint_auth_method: authMethod,
      ...(secret && { client_secret: secret, client_secret_expires_at: 0 }),
    });
  });

  router.get("/authorize", async (req, res) => {
    const q = req.query;
    const client = typeof q.client_id === "string" ? await OAuthClient.findOne({ clientId: q.client_id }) : null;
    if (!client) return errorPage(res, "This app isn't registered with XMusic. Try connecting again from the app.");
    let redirectUri = q.redirect_uri;
    if (!redirectUri && client.redirectUris.length === 1) redirectUri = client.redirectUris[0];
    if (typeof redirectUri !== "string" || !client.redirectUris.includes(redirectUri)) {
      return errorPage(res, "The app's return address doesn't match what it registered.");
    }
    const state = typeof q.state === "string" ? q.state : undefined;
    const fail = (error, description) =>
      res.redirect(withParams(redirectUri, { error, error_description: description, state, iss: issuer() }));

    if (q.response_type !== "code") return fail("unsupported_response_type", 'Only response_type "code" is supported.');
    if (typeof q.code_challenge !== "string" || q.code_challenge_method !== "S256" || q.code_challenge.length < 43) {
      return fail("invalid_request", "PKCE with code_challenge_method S256 is required.");
    }
    const scope = normalizeScope(q.scope);
    if (!scope) return fail("invalid_scope", `Supported scopes: ${Object.keys(SCOPES).join(", ")}.`);
    const resource = typeof q.resource === "string" && q.resource ? q.resource : resourceUrl();
    if (resource !== resourceUrl()) return fail("invalid_target", `The only resource is ${resourceUrl()}.`);

    const requestId = randomToken(24);
    await OAuthRequest.create({
      requestId,
      clientId: client.clientId,
      redirectUri,
      state,
      codeChallenge: q.code_challenge,
      scope,
      resource,
    });
    return res.redirect(`${clientUrl()}/connect?request=${encodeURIComponent(requestId)}`);
  });

  // What the /connect page shows (the request id itself is the secret)
  router.get("/requests/:id", async (req, res) => {
    const request = await OAuthRequest.findOne({ requestId: req.params.id });
    if (!request) return res.status(404).json({ message: "This request has expired. Go back to the app and connect again." });
    const client = await OAuthClient.findOne({ clientId: request.clientId });
    return res.json({
      clientName: client?.clientName ?? "An app",
      redirectHost: new URL(request.redirectUri).host,
      scopes: request.scope.split(" ").map((id) => ({ id, description: SCOPES[id] })),
    });
  });

  router.post("/requests/:id/decision", sameSite, authMiddleware, async (req, res) => {
    // Single use: whatever the answer, the request is done
    const request = await OAuthRequest.findOneAndDelete({ requestId: req.params.id });
    if (!request) return res.status(404).json({ message: "This request has expired. Go back to the app and connect again." });
    const base = { state: request.state, iss: issuer() };
    if (req.body?.allow !== true) {
      return res.json({ redirect: withParams(request.redirectUri, { ...base, error: "access_denied" }) });
    }
    const code = randomToken(32);
    await OAuthCode.create({
      codeHash: sha256(code),
      clientId: request.clientId,
      user: req.user._id,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      scope: request.scope,
      resource: request.resource,
      expiresAt: new Date(Date.now() + CODE_SECONDS * 1000),
    });
    return res.json({ redirect: withParams(request.redirectUri, { ...base, code }) });
  });

  router.post("/token", tokenLimit, async (req, res) => {
    try {
      const client = await authenticateClient(req);
      if (!client) return oauthError(res, 401, "invalid_client");
      const body = req.body || {};

      if (body.grant_type === "authorization_code") {
        if (typeof body.code !== "string" || typeof body.code_verifier !== "string") {
          return oauthError(res, 400, "invalid_request", "code and code_verifier are required.");
        }
        // Single use: taken out whether or not the rest checks out
        const code = await OAuthCode.findOneAndDelete({ codeHash: sha256(body.code) });
        const bad = (why) => oauthError(res, 400, "invalid_grant", why);
        if (!code || code.expiresAt < new Date()) return bad("The code is invalid or has expired.");
        if (code.clientId !== client.clientId) return bad("The code was issued to another app.");
        if (body.redirect_uri !== undefined && body.redirect_uri !== code.redirectUri) return bad("redirect_uri doesn't match.");
        if (!safeEqual(pkceChallenge(body.code_verifier), code.codeChallenge)) return bad("PKCE verification failed.");
        if (body.resource !== undefined && body.resource !== code.resource) return bad("resource doesn't match.");
        // One grant per listener and app: connecting again replaces it
        const grant =
          (await OAuthGrant.findOne({ user: code.user, clientId: client.clientId })) ??
          new OAuthGrant({ user: code.user, clientId: client.clientId });
        grant.clientName = client.clientName;
        grant.scope = code.scope;
        grant.resource = code.resource;
        return issueTokens(res, grant);
      }

      if (body.grant_type === "refresh_token") {
        if (typeof body.refresh_token !== "string") return oauthError(res, 400, "invalid_request", "refresh_token is required.");
        const grant = await OAuthGrant.findOne({ refreshHash: sha256(body.refresh_token), clientId: client.clientId });
        if (!grant || !grant.refreshExpiresAt || grant.refreshExpiresAt < new Date()) {
          return oauthError(res, 400, "invalid_grant", "The refresh token is invalid or has expired.");
        }
        return issueTokens(res, grant);
      }

      return oauthError(res, 400, "unsupported_grant_type");
    } catch (err) {
      console.error("OAuth token error:", err);
      return oauthError(res, 500, "server_error");
    }
  });

  router.post("/revoke", tokenLimit, async (req, res) => {
    const client = await authenticateClient(req);
    if (!client) return oauthError(res, 401, "invalid_client");
    const token = req.body?.token;
    if (typeof token === "string" && token) {
      const byRefresh = await OAuthGrant.deleteOne({ refreshHash: sha256(token), clientId: client.clientId });
      if (!byRefresh.deletedCount) {
        try {
          const payload = verifyAccessToken(token, resourceUrl());
          if (payload.cid === client.clientId && mongoose.isValidObjectId(payload.gid)) {
            await OAuthGrant.deleteOne({ _id: payload.gid, clientId: client.clientId });
          }
        } catch {
          // Unknown or expired token: nothing to revoke
        }
      }
    }
    return res.status(200).end();
  });

  // Connected apps
  router.get("/grants", authMiddleware, async (req, res) => {
    const grants = await OAuthGrant.find({ user: req.user._id }).sort({ lastUsedAt: -1 });
    return res.json({
      grants: grants.map((g) => ({
        id: String(g._id),
        clientName: g.clientName,
        scopes: g.scope.split(" ").map((id) => ({ id, description: SCOPES[id] })),
        createdAt: g.createdAt,
        lastUsedAt: g.lastUsedAt,
      })),
    });
  });

  router.delete("/grants/:id", sameSite, authMiddleware, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Not found" });
    const { deletedCount } = await OAuthGrant.deleteOne({ _id: req.params.id, user: req.user._id });
    if (!deletedCount) return res.status(404).json({ message: "Not found" });
    return res.json({ ok: true });
  });

  return router;
}

module.exports = { createOAuthRouter };
