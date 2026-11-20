// The MCP endpoint ChatGPT connects to: POST /mcp (Streamable HTTP, stateless).
//
// Who the listener is: the OAuth access token (Authorization: Bearer ...)
// that ChatGPT got when the listener approved it on the /connect page. The
// token's grant must still exist, and its scopes decide which tools exist.
//
// For local testing only, MCP_DEV_USER (an email) lets requests without a
// token act as that account - only from this machine, never through a
// tunnel or proxy, and never when NODE_ENV=production.

const express = require("express");
const mongoose = require("mongoose");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const User = require("../models/User");
const OAuthGrant = require("../models/OAuthGrant");
const { ALL_SCOPES, resourceUrl, verifyAccessToken } = require("../oauth/config");
const { resourceMetadataUrl } = require("../oauth/metadata");
const { registerTools } = require("./tools");

const SERVER_INFO = { name: "xmusic", title: "XMusic", version: "0.1.0" };
const INSTRUCTIONS =
  "XMusic is the listener's music player, running in their browser. Use these tools to find music and play it there. " +
  "For a mood or vibe (\"play some sad songs\"), pick fitting songs yourself and call `play` with them as queries. " +
  "If a tool says the browser blocked autoplay, tell the user to click the XMusic tab once.";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

function jsonRpcError(res, status, message) {
  return res.status(status).json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });
}

function publicHost() {
  try {
    return process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).host : null;
  } catch {
    return null;
  }
}

/**
 * Only answer to our own host names, so a web page can't reach /mcp through
 * DNS rebinding, and refuse browser requests from other sites.
 */
function checkOrigin(req) {
  const host = String(req.headers.host || "").toLowerCase();
  const hostname = host.replace(/:\d+$/, "");
  const allowedHost = LOCAL_HOSTS.includes(hostname) || host === publicHost();
  if (!allowedHost) return false;
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const { host: originHost, hostname: originName } = new URL(origin);
    return LOCAL_HOSTS.includes(originName) || originHost === publicHost();
  } catch {
    return false;
  }
}

/** Came straight from this machine (not through a tunnel or proxy) */
function isLocalRequest(req) {
  const hostname = String(req.headers.host || "").toLowerCase().replace(/:\d+$/, "");
  const remote = req.socket.remoteAddress || "";
  const proxied = ["x-forwarded-for", "x-forwarded-host", "forwarded", "cf-ray", "cf-connecting-ip"].some(
    (header) => header in req.headers,
  );
  const loopback = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  return LOCAL_HOSTS.includes(hostname) && loopback && !proxied;
}

/** MCP_DEV_USER's id, for local requests without a token; or null */
async function devUserId(req) {
  if (process.env.NODE_ENV === "production" || !isLocalRequest(req)) return null;
  const email = process.env.MCP_DEV_USER?.trim();
  if (!email) return null;
  const user = await User.findOne({ email }).select("_id");
  return user ? String(user._id) : null;
}

/** 401 that tells the client where to sign in (RFC 9728) */
function unauthorized(res, error, description) {
  const params = [`resource_metadata="${resourceMetadataUrl()}"`];
  if (error) params.push(`error="${error}"`, `error_description="${description}"`);
  res.set("WWW-Authenticate", `Bearer ${params.join(", ")}`);
  return jsonRpcError(res, 401, description || "Sign in to XMusic to use it here.");
}

/**
 * -> { userId, scopes } for the request, or null after answering 401.
 * A token is checked against its grant, so a disconnected app is locked out
 * at once rather than when its token expires.
 */
async function authenticate(req, res) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    let payload;
    try {
      payload = verifyAccessToken(header.slice(7).trim(), resourceUrl());
    } catch {
      unauthorized(res, "invalid_token", "The access token is invalid or has expired.");
      return null;
    }
    const grant = mongoose.isValidObjectId(payload.gid)
      ? await OAuthGrant.findOne({ _id: payload.gid, user: payload.sub, clientId: payload.cid }).select(
          "_id clientName lastUsedAt",
        )
      : null;
    if (!grant) {
      unauthorized(res, "invalid_token", "This app was disconnected from XMusic. Connect it again.");
      return null;
    }
    // "Last used" in Connected apps: at most one write a minute
    if (!grant.lastUsedAt || Date.now() - grant.lastUsedAt.getTime() > 60 * 1000) {
      OAuthGrant.updateOne({ _id: grant._id }, { lastUsedAt: new Date() }).catch(() => {});
    }
    return {
      userId: String(payload.sub),
      scopes: String(payload.scope || "").split(" ").filter(Boolean),
      app: grant.clientName,
    };
  }
  const devUser = await devUserId(req);
  if (devUser) return { userId: devUser, scopes: ALL_SCOPES, app: "MCP_DEV_USER" };
  unauthorized(res);
  return null;
}

function createMcpRouter() {
  const router = express.Router();

  router.post("/", async (req, res) => {
    if (!checkOrigin(req)) return jsonRpcError(res, 403, "Forbidden");
    let auth;
    try {
      auth = await authenticate(req, res);
    } catch (err) {
      console.error(err);
      return jsonRpcError(res, 500, "Server Error!");
    }
    if (!auth) return;
    const { userId, scopes, app } = auth;
    // One line per call in the server log: which app, what it asked for
    const calls = (Array.isArray(req.body) ? req.body : [req.body]).filter(Boolean);
    for (const call of calls) {
      const what = call.method === "tools/call" ? `tools/call ${call.params?.name}` : call.method;
      if (what && what !== "notifications/initialized") console.log(`[mcp] ${app}: ${what}`);
    }

    // Stateless: a fresh server + transport per request
    const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
    registerTools(server, { userId, scopes });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("MCP request failed:", err);
      if (!res.headersSent) jsonRpcError(res, 500, "Server Error!");
    }
  });

  // No server-initiated streams or sessions in stateless mode
  router.all("/", (req, res) => {
    res.set("Allow", "POST");
    return jsonRpcError(res, 405, "Method not allowed.");
  });

  return router;
}

module.exports = { createMcpRouter };
