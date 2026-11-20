// OAuth discovery: how ChatGPT (or any MCP client) learns where to sign the
// listener in. RFC 9728 (protected resource) and RFC 8414 (auth server).

const express = require("express");
const { ALL_SCOPES, issuer, resourceUrl } = require("./config");

function protectedResource() {
  return {
    resource: resourceUrl(),
    authorization_servers: [issuer()],
    scopes_supported: ALL_SCOPES,
    bearer_methods_supported: ["header"],
    resource_name: "XMusic",
  };
}

function authorizationServer() {
  const base = issuer();
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    scopes_supported: ALL_SCOPES,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    authorization_response_iss_parameter_supported: true,
  };
}

/** Where the 401 from /mcp points clients */
const resourceMetadataUrl = () => `${issuer()}/.well-known/oauth-protected-resource/mcp`;

function createMetadataRouter() {
  const router = express.Router();
  const send = (build) => (req, res) => {
    res.set("Cache-Control", "public, max-age=300");
    res.set("Access-Control-Allow-Origin", "*");
    return res.json(build());
  };
  router.get(
    ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"],
    send(protectedResource),
  );
  router.get(
    [
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-authorization-server/mcp",
      "/.well-known/openid-configuration",
    ],
    send(authorizationServer),
  );
  return router;
}

module.exports = { createMetadataRouter, resourceMetadataUrl };
