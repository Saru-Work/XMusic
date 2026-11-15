const User = require("../models/User");
const { verifyToken } = require("../utils/jwt.util");

async function auth_middleware(req, res, next) {
  const token = req.cookies.access_token;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized!" });
  }
  try {
    const verified = verifyToken(token);
    const user = await User.findOne({ _id: verified.sub }).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Unauthorized!" });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized!" });
  }
}

module.exports = auth_middleware;
