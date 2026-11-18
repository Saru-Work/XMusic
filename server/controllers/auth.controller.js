const User = require("../models/User");
const { generateToken, verifyToken, LOGIN_TTL_MS } = require("../utils/jwt.util");
const bcrypt = require("bcrypt");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(user) {
  return {
    _id: user._id,
    isArtist: user.isArtist,
    email: user.email,
    photoUrl: user.photoUrl,
    name: user.name,
  };
}

/** Sets the login cookie and answers like every login endpoint does */
function logIn(res, user) {
  const token = generateToken(user);
  res.cookie("access_token", token, {
    httpOnly: true,
    maxAge: LOGIN_TTL_MS,
    secure: false,
    sameSite: "lax",
    path: "/",
  });
  return res.json({ user: publicUser(user), token });
}

async function register(req, res) {
  const email = (req.body?.email || "").trim();
  const password = req.body?.password || "";
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "Enter a valid email address" });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters" });
  }
  try {
    const existing_user = await User.findOne({ email });
    if (existing_user) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    }
    const hashed_password = await bcrypt.hash(password, 10);
    const new_user = await User.create({ email, password: hashed_password });
    return logIn(res, new_user);
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function login(req, res) {
  const email = (req.body?.email || "").trim();
  const password = req.body?.password || "";
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Incorrect email or password" });
    }
    if (!user.password) {
      // Created with Google sign-in, so there's no password to check
      return res.status(401).json({
        message: "This account signs in with Google. Use Continue with Google.",
      });
    }
    const verify_password = await bcrypt.compare(password, user.password);
    if (!verify_password) {
      return res.status(401).json({ message: "Incorrect email or password" });
    }
    return logIn(res, user);
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

// Always answers 200 so a logged-out visitor doesn't produce console errors
async function check_auth(req, res) {
  const token = req.cookies.access_token;
  if (!token) {
    return res.json({ authenticated: false });
  }
  try {
    verifyToken(token);
    return res.json({ authenticated: true });
  } catch (err) {
    return res.json({ authenticated: false });
  }
}
async function logout(req, res) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  res.clearCookie("access_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
  return res.json({ message: "Successfully logged out!" });
}
async function get_profile(req, res) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized!" });
  }
  return res.json(user);
}

module.exports = { login, register, check_auth, get_profile, logout };
