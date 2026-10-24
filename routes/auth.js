'use strict';
const auth = require('../lib/auth');

function loginRateLimit() {
  const attempts = new Map(), windowMs = 10 * 60 * 1000;
  return {
    blocked(ip) { const now = Date.now(), recent = (attempts.get(ip) || []).filter(t => now - t < windowMs); attempts.set(ip, recent); return recent.length >= 10; },
    failed(ip) { const now = Date.now(), recent = (attempts.get(ip) || []).filter(t => now - t < windowMs); recent.push(now); attempts.set(ip, recent); },
    clear(ip) { attempts.delete(ip); }
  };
}
const loginLimiter = loginRateLimit();

function sameOrigin(req) {
  const origin = req.headers.origin; if (!origin) return true;
  try { const u = new URL(origin); return u.host === req.headers.host && ['http:', 'https:'].includes(u.protocol); } catch { return false; }
}

async function handleAuth(req, res, url, readBody, send, recordSecurityEvent) {
  const p = url.pathname, m = req.method;
  const secure = !!req.socket.encrypted || process.env.NODE_ENV === 'production';

  if (p === '/api/auth/session' && m === 'GET') {
    return send(res, 200, { user: auth.actorPayload(auth.currentActor(req)) });
  }

  if (p === '/api/auth/login' && m === 'POST') {
    if (!sameOrigin(req)) return send(res, 403, { error: 'Origin rejected' });
    const ip = req.socket.remoteAddress || 'unknown';
    if (loginLimiter.blocked(ip)) return send(res, 429, { error: 'Too many failed login attempts; wait ten minutes' });
    const data = await readBody(req);
    const actor = await auth.login(data.username, data.password, res, secure);
    if (!actor) {
      loginLimiter.failed(ip);
      recordSecurityEvent('LOGIN_FAILURE', String(data.username || '').slice(0, 80), 'DENIED');
      return send(res, 401, { error: 'Invalid username or password, or demo accounts are not configured' });
    }
    loginLimiter.clear(ip);
    return send(res, 200, { user: auth.actorPayload(actor) });
  }

  if (p === '/api/auth/logout' && m === 'POST') {
    if (!sameOrigin(req)) return send(res, 403, { error: 'Origin rejected' });
    auth.logout(req, res, secure);
    return send(res, 200, { ok: true });
  }

  return null;
}

module.exports = { handleAuth };