// Tiny in-memory limiter (per IP) - enough to slow brute-force login attempts.
function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, message = 'Too many attempts, try again later' } = {}) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, v] of hits) if (v.reset < now) hits.delete(key);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const rec = hits.get(req.ip) || { count: 0, reset: now + windowMs };
    if (rec.reset < now) { rec.count = 0; rec.reset = now + windowMs; }
    rec.count += 1;
    hits.set(req.ip, rec);
    if (rec.count > max) return res.status(429).json({ message });
    next();
  };
}
module.exports = rateLimit;
