const User = require("../models/User");
const { verifyToken } = require("../utils/jwt.util");

async function auth_middleware(req, res, next) {
  const token = req.cookies.access_token;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized!" });
  }
  const verified = verifyToken(token);
  if (!verified) {
    return res.status(401).json({ message: "Unauthorized!" });
  }
  const user = await User.findOne({ _id: verified.sub }).select("-password");
  req.user = user;
  next();
}

module.exports = auth_middleware;
