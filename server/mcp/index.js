// The MCP endpoint ChatGPT connects to: POST /mcp (Streamable HTTP, stateless).
//
// Who the listener is: until OAuth is added (phase 3), /mcp acts as the
// account named by MCP_DEV_USER (an email) and only answers on localhost,
// or on PUBLIC_URL's host when that is set (e.g. a tunnel for ChatGPT).
// It is never enabled when NODE_ENV=production.

const express = require("express");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const User = require("../models/User");
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

/** The listener this request acts for, or null */
async function devUserId() {
  if (process.env.NODE_ENV === "production") return null;
  const email = process.env.MCP_DEV_USER?.trim();
  if (!email) return null;
  const user = await User.findOne({ email }).select("_id");
  return user ? String(user._id) : null;
}

function createMcpRouter() {
  const router = express.Router();

  router.post("/", async (req, res) => {
    if (!checkOrigin(req)) return jsonRpcError(res, 403, "Forbidden");
    let userId;
    try {
      userId = await devUserId();
    } catch (err) {
      console.error(err);
      return jsonRpcError(res, 500, "Server Error!");
    }
    if (!userId) {
      return jsonRpcError(
        res,
        401,
        "XMusic MCP isn't set up: set MCP_DEV_USER in server/.env to the email of an XMusic account.",
      );
    }

    // Stateless: a fresh server + transport per request
    const server = new McpServer(SERVER_INFO, { instructions: INSTRUCTIONS });
    registerTools(server, { userId });
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
