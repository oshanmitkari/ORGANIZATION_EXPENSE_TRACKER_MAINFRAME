'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DATA_DIR = process.env.APP_DATA_DIR || path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ROLES = Object.freeze({
  EMPLOYEE: ['expense:create','expense:read_own','expense:update_own_draft','expense:submit','employee:read','report:read_own'],
  MANAGER: ['expense:read_team','expense:approve_assigned','expense:reject_assigned','employee:read','report:read_team'],
  FINANCE_OPERATOR: ['expense:create','expense:read_all','expense:update_own_draft','expense:update_all_draft','expense:submit','expense:post','employee:read','batch:read','batch:execute','report:read','report:export'],
  FINANCE_ADMIN: ['expense:create','expense:read_all','expense:update_own_draft','expense:update_all_draft','expense:submit','expense:approve_assigned','expense:reject_assigned','expense:post','employee:read','employee:manage','category:manage','batch:read','batch:execute','batch:restart','report:read','report:export','audit:read','user:manage_roles','system:configure'],
  AUDITOR: ['expense:read_all','employee:read','batch:read','report:read','report:export','audit:read']
});
const sessions = new Map();
const SESSION_MS = 4 * 60 * 60 * 1000;
function permissions(role) { return ROLES[role] || []; }
function allowed(actor, permission) { return permissions(actor && actor.role).includes(permission); }
function requirePermission(actor, permission) {
  if (!actor) { const e = new Error('Authentication required'); e.status = 401; throw e; }
  if (!allowed(actor, permission)) { const e = new Error('Permission denied'); e.status = 403; throw e; }
}
function requireAny(actor, list) {
  if (!actor) { const e = new Error('Authentication required'); e.status = 401; throw e; }
  if (!list.some(p => allowed(actor, p))) { const e = new Error('Permission denied'); e.status = 403; throw e; }
}
function cookie(req, name) {
  const header = req.headers.cookie || '';
  for (const item of header.split(';')) {
    const i = item.indexOf('='); if (i < 0) continue;
    if (item.slice(0, i).trim() === name) return decodeURIComponent(item.slice(i + 1).trim());
  }
  return '';
}
function currentActor(req) {
  const token = cookie(req, 'apex.sid'), session = sessions.get(token);
  if (!session) return null;
  if (session.expires <= Date.now()) { sessions.delete(token); return null; }
  session.expires = Date.now() + SESSION_MS;
  return session.actor;
}
function setCookie(res, token, secure) {
  res.setHeader('Set-Cookie', `apex.sid=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`);
}
function clearCookie(res, secure) {
  res.setHeader('Set-Cookie', `apex.sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`);
}
function hash(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, key) => e ? reject(e) : resolve(key.toString('hex'))));
}
async function login(username, password, res, secure) {
  if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 200) return null;
  let list = [];
  try { list = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return null; }
  const user = list.find(x => x.username.toLowerCase() === username.trim().toLowerCase());
  // Always perform a scrypt operation, including unknown usernames.
  const salt = user?.salt || 'apex-demo-login-dummy-salt';
  const candidate = await hash(password, salt);
  const expected = user?.passwordHash || '0'.repeat(128);
  const match = crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(expected, 'hex'));
  if (!user || !match || !ROLES[user.role]) return null;
  const token = crypto.randomBytes(32).toString('base64url');
  const actor = Object.freeze({ username: user.username, name: user.name, role: user.role, employeeId: user.employeeId });
  sessions.set(token, { actor, expires: Date.now() + SESSION_MS }); setCookie(res, token, secure);
  return actor;
}
function logout(req, res, secure) { const token = cookie(req, 'apex.sid'); if (token) sessions.delete(token); clearCookie(res, secure); }
function actorPayload(actor) { return actor ? { username: actor.username, name: actor.name, role: actor.role, employeeId: actor.employeeId, permissions: permissions(actor.role) } : null; }
module.exports = { ROLES, USERS_FILE, permissions, allowed, requirePermission, requireAny, currentActor, login, logout, actorPayload, hash };
