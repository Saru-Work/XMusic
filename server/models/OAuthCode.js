const mongoose = require("mongoose");

// A one-time authorization code (stored hashed), exchanged at /oauth/token.
// Valid for 60 seconds; MongoDB removes leftovers.
const OAuthCodeSchema = new mongoose.Schema({
  codeHash: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  redirectUri: { type: String, required: true },
  codeChallenge: { type: String, required: true },
  scope: { type: String, required: true },
  resource: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, expires: 5 * 60 },
});

module.exports = mongoose.model("OAuthCode", OAuthCodeSchema);
