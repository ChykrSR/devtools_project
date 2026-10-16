'use strict';
const crypto = require('node:crypto');
const sessions = new Map();
const COOKIE = 'clinic_session';
const TTL = 60 * 60 * 1000;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function token(req) {
  return (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
}
function cookieOptions(req) {
  return { httpOnly: true, sameSite: 'lax', secure: req.secure || process.env.COOKIE_SECURE === '1', path: '/' };
}
function read(req) {
  const value = token(req);
  if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
  const key = hash(value), session = sessions.get(key);
  if (!session || session.expires <= Date.now()) { sessions.delete(key); return null; }
  return session;
}
function end(req, res) {
  const value = token(req); if (value) sessions.delete(hash(value));
  res.clearCookie(COOKIE, cookieOptions(req));
}
function create(req, res, userId) {
  for (const [key, session] of sessions) if (session.expires <= Date.now()) sessions.delete(key);
  // Rotate the session when signing in again or switching accounts.
  end(req, res);
  const value = crypto.randomBytes(32).toString('hex');
  sessions.set(hash(value), { id: userId, expires: Date.now() + TTL });
  res.cookie(COOKIE, value, { ...cookieOptions(req), maxAge: TTL });
}
module.exports = { create, read, end };
