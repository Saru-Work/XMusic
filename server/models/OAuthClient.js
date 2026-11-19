const mongoose = require("mongoose");

// An app that registered itself to connect to XMusic (e.g. ChatGPT), through
// OAuth dynamic client registration.
const OAuthClientSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true },
  /** sha256 of the secret, for clients that asked for one */
  clientSecretHash: String,
  /** "none" (public client with PKCE), "client_secret_post" or "client_secret_basic" */
  authMethod: { type: String, default: "none" },
  clientName: { type: String, default: "An app" },
  redirectUris: { type: [String], required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("OAuthClient", OAuthClientSchema);
