const mongoose = require("mongoose");

// A listener's permission for an app to use their account. Access tokens
// carry the grant id and stop working the moment the grant is deleted
// (Connected apps > Disconnect). The refresh token is stored hashed and
// replaced on every use.
const OAuthGrantSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
  clientId: { type: String, required: true },
  clientName: { type: String, default: "An app" },
  scope: { type: String, required: true },
  resource: { type: String, required: true },
  refreshHash: { type: String, index: true },
  refreshExpiresAt: Date,
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("OAuthGrant", OAuthGrantSchema);
