// Tiny in-memory rate limiter (per client IP), enough to stop someone
// hammering the token and registration endpoints.

function rateLimit({ limit, windowMs }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
      if (hits.size > 10000) {
        for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
      }
    }
    entry.count += 1;
    if (entry.count > limit) {
      res.set("Retry-After", String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: "slow_down", error_description: "Too many requests. Try again shortly." });
    }
    next();
  };
}

module.exports = { rateLimit };
