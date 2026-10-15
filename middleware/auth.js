const jwt = require('jsonwebtoken');

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
const EXPIRES_HOURS = Number(process.env.JWT_EXPIRES_HOURS) || 8;

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, {
    expiresIn: `${EXPIRES_HOURS}h`,
  });
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,                                   // not readable from JavaScript (XSS safe)
    sameSite: 'lax',                                  // basic CSRF protection
    secure: process.env.NODE_ENV === 'production',
    maxAge: EXPIRES_HOURS * 3600 * 1000,
  });
}

function readToken(req) {
  const header = req.headers.authorization;
  const token = req.cookies?.token || (header && header.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

// Attach req.user when a valid token exists, never blocks
function optionalAuth(req, res, next) {
  req.user = readToken(req);
  next();
}

// API: must be logged in
function authenticate(req, res, next) {
  const user = readToken(req);
  if (!user) return res.status(401).json({ message: 'Please log in to continue' });
  req.user = user;
  next();
}

// API: must be admin (use after authenticate)
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
}

// HTML pages: redirect instead of JSON errors
function pageGuard(role) {
  return (req, res, next) => {
    const user = readToken(req);
    if (!user) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    if (role && user.role !== role) return res.redirect('/');
    req.user = user;
    next();
  };
}

module.exports = { signToken, setAuthCookie, optionalAuth, authenticate, requireAdmin, pageGuard };
