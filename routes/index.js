'use strict';
const { handleAuth } = require('./auth');
const { handleExpenses } = require('./expenses');
const { handleBatch } = require('./batch');
const auth = require('../lib/auth');
const { recordSecurityEvent } = require('../lib/workflow');

function createRouter(rd, wr, FILES, nextId, D) {
  return async function route(req, res, url) {
    const p = url.pathname, m = req.method;

    const send = (res, code, value, type) => {
      res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
    };

    const readBody = req => new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', chunk => { raw += chunk; if (raw.length > 1_000_000) { reject(Object.assign(new Error('Request body too large'), { status: 413 })); req.destroy(); } });
      req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(Object.assign(new Error('Invalid JSON body'), { status: 400 })); } });
    });

    const secure = !!req.socket.encrypted || process.env.NODE_ENV === 'production';

    let result = await handleAuth(req, res, url, readBody, send, recordSecurityEvent);
    if (result !== null) return;

    const actor = auth.currentActor(req);
    if (!actor) return send(res, 401, { error: 'Authentication required' });

    const sameOrigin = (req) => {
      const origin = req.headers.origin; if (!origin) return true;
      try { const u = new URL(origin); return u.host === req.headers.host && ['http:', 'https:'].includes(u.protocol); } catch { return false; }
    };

    if (!sameOrigin(req)) { recordSecurityEvent('CSRF_ORIGIN_REJECT', p, 'DENIED'); return send(res, 403, { error: 'Origin rejected' }); }

    const requiredPermission = (req, actor) => {
      const p = req.url.split('?')[0], m = req.method;
      if (p === '/api/enterprise' && m === 'GET') return ({ EMPLOYEE: 'expense:read_own', MANAGER: 'expense:read_team', FINANCE_OPERATOR: 'expense:read_all', FINANCE_ADMIN: 'expense:read_all', AUDITOR: 'expense:read_all' })[actor.role];
      if (p === '/api/dashboard' && m === 'GET') return ({ EMPLOYEE: 'report:read_own', MANAGER: 'report:read_team', FINANCE_OPERATOR: 'report:read', FINANCE_ADMIN: 'report:read', AUDITOR: 'report:read' })[actor.role];
      if (p === '/api/reports' && m === 'GET') return ({ EMPLOYEE: 'report:read_own', MANAGER: 'report:read_team', FINANCE_OPERATOR: 'report:read', FINANCE_ADMIN: 'report:read', AUDITOR: 'report:read' })[actor.role];
      if (p === '/api/audit' && m === 'GET') return 'audit:read';
      if (p === '/api/expenses' && m === 'POST') return 'expense:create';
      if (p === '/api/employees' && m === 'POST') return 'employee:manage';
      if (p === '/api/run' && m === 'POST') return 'batch:execute';
      if (p === '/api/upload' && m === 'POST' || p === '/api/sample' && m === 'POST' || p === '/api/transactions' && (m === 'POST' || m === 'DELETE')) return 'batch:execute';
      if (p === '/api/transactions' && m === 'GET' || p === '/api/state' && m === 'GET' || p === '/api/cobol/status' && m === 'GET' || p.startsWith('/api/file/') && m === 'GET') return 'batch:read';
      if (p === '/api/master' && m === 'POST') return 'employee:manage';
      const e = p.match(/^\/api\/expenses\/[^/]+(?:\/(submit|approve|reject|post))?$/);
      if (e) { switch (e[1]) { case 'submit': return 'expense:submit'; case 'approve': return 'expense:approve_assigned'; case 'reject': return 'expense:reject_assigned'; case 'post': return 'expense:post'; default: if (m === 'PATCH') return ['FINANCE_OPERATOR', 'FINANCE_ADMIN'].includes(actor.role) ? 'expense:update_all_draft' : 'expense:update_own_draft'; if (m === 'GET') return ({ EMPLOYEE: 'expense:read_own', MANAGER: 'expense:read_team', FINANCE_OPERATOR: 'expense:read_all', FINANCE_ADMIN: 'expense:read_all', AUDITOR: 'expense:read_all' })[actor.role]; } }
      return null;
    };

    const permission = requiredPermission(req, actor);
    if (permission) {
      try { auth.requirePermission(actor, permission); } catch (e) { recordSecurityEvent('AUTHZ_DENIED', `${actor.username}:${m} ${p}`, 'DENIED'); return send(res, e.status, e); }
    } else if (p.startsWith('/api/')) return send(res, 404, { error: 'not found' });

    result = await handleExpenses(req, res, url, readBody, send, recordSecurityEvent, rd, wr, FILES, nextId, actor, D);
    if (result !== null) return;

    result = await handleBatch(req, res, url, readBody, send, rd, wr, FILES, actor, D);
    if (result !== null) return;

    return send(res, 404, { error: 'not found' });
  };
}

module.exports = { createRouter };