const mongoose = require("mongoose");

// A pending "Allow <app> to use XMusic?" request, between /oauth/authorize and
// the listener's choice on the /connect page. Gone after 10 minutes.
const OAuthRequestSchema = new mongoose.Schema({
  /** Random id put in the /connect link */
  requestId: { type: String, required: true, unique: true },
  clientId: { type: String, required: true },
  redirectUri: { type: String, required: true },
  state: String,
  codeChallenge: { type: String, required: true },
  scope: { type: String, required: true },
  resource: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 10 * 60 },
});

module.exports = mongoose.model("OAuthRequest", OAuthRequestSchema);
