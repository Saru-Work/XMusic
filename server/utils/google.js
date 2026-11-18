// Google sign-in: checks the ID token ("credential") that Google Identity
// Services hands the browser, and returns who signed in.

const { OAuth2Client } = require("google-auth-library");

class GoogleAuthError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let client = null;

/** The OAuth client id from Google Cloud, or null when Google sign-in is off */
function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() || null;
}

/**
 * -> { googleId, email, emailVerified, name, picture }
 * Throws GoogleAuthError (503 when not set up, 401 for a bad token).
 */
async function verifyGoogleCredential(credential) {
  const clientId = googleClientId();
  if (!clientId) throw new GoogleAuthError("Google sign-in isn't set up on this server.", 503);
  if (typeof credential !== "string" || !credential) {
    throw new GoogleAuthError("Missing Google credential.", 400);
  }
  client ??= new OAuth2Client();
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    throw new GoogleAuthError("Google sign-in failed. Please try again.", 401);
  }
  if (!payload?.sub || !payload.email) {
    throw new GoogleAuthError("Google didn't share an email address for this account.", 401);
  }
  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: payload.name,
    picture: payload.picture,
  };
}

module.exports = { googleClientId, verifyGoogleCredential, GoogleAuthError };
