const User = require("../models/User");
const { generateToken, verifyToken } = require("../utils/jwt.util");
const bcrypt = require("bcrypt");

async function register(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(401).json({ message: "Credentials not found!" });
  }
  try {
    const existing_user = await User.findOne({ email });
    if (existing_user) {
      return res.status(409).json({ message: "User already exists!" });
    }
    const hashed_password = await bcrypt.hash(password, 10);
    const new_user = await User.create({ email, password: hashed_password });
    const token = generateToken(new_user);
    res.cookie("access_token", token, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000,
      secure: false,
      sameSite: "lax",
    });
    return res.json({ user: new_user, token });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(401).json({ message: "Credentials not found!" });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }
    const verify_password = await bcrypt.compare(password, user.password);
    if (!verify_password) {
      return res.status(401).json({ message: "Incorrect Password!" });
    }
    const token = generateToken(user);
    res.cookie("access_token", token, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000,
      secure: false,
      sameSite: "lax",
    });
    return res.json({
      user: {
        isArtist: user.isArtist,
        email: user.email,
        photoUrl: user.photoUrl,
        name: user.name,
      },
      token,
    });
  } catch (err) {
    return res.status(500).json({ message: "Server Error!" });
  }
}

async function check_auth(req, res) {
  const token = req.cookies.access_token;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized!" });
  }
  const verified = verifyToken(token);
  if (verified) {
    return res.json({ authenticated: true });
  } else {
    return res.status(401).json({ authenticated: false });
  }
}
async function logout(req, res) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
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
