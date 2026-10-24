'use strict';
const { workflow } = require('../lib/workflow');
const { makeRecord, makeMaster, masterId } = require('../lib/pipeline');
const fs = require('fs');
const path = require('path');

async function handleExpenses(req, res, url, readBody, send, recordSecurityEvent, rd, wr, FILES, nextId, actor, D) {
  const p = url.pathname, m = req.method;

  if ((p === '/api/enterprise' || p === '/api/dashboard' || p === '/api/reports' || p === '/api/audit' || p === '/api/expenses' || p === '/api/employees' || p.startsWith('/api/expenses/')) && ['GET', 'POST', 'PATCH'].includes(m)) {
    const data = ['POST', 'PATCH'].includes(m) ? await readBody(req) : {};
    try {
      const result = workflow(actor, { pathname: p, method: m }, data);
      if (result !== null) return send(res, m === 'POST' && (p === '/api/expenses' || p === '/api/employees') ? 201 : 200, result);
    } catch (e) {
      if (e.status === 403) recordSecurityEvent('OBJECT_ACCESS_DENIED', `${actor.username}:${m} ${p}`, 'DENIED');
      return send(res, e.status || 400, { error: e.message || 'request failed' });
    }
  }

  if (m === 'POST' && p === '/api/transactions') {
    const b = await readBody(req);
    if (!b.emp || !b.date || !b.cat || b.amount === '' || b.amount == null) return send(res, 400, { error: 'emp, date, cat and amount are required' });
    const rec = makeRecord({ ...b, id: nextId() });
    wr('EXPENSE.TRANS', rd('EXPENSE.TRANS').concat(rec));
    return send(res, 201, { record: rec });
  }

  if (m === 'POST' && p === '/api/upload') {
    const b = await readBody(req), lines = String(b.text || '').replace(/\r/g, '').split('\n').filter(x => x.length);
    if (lines.some(x => Buffer.byteLength(x, 'utf8') !== 80 || /[^\x20-\x7E]/.test(x))) return send(res, 400, { error: 'Every input record must be exactly 80 single-byte printable characters; no records were appended.' });
    wr('EXPENSE.TRANS', rd('EXPENSE.TRANS').concat(lines));
    return send(res, 201, { added: lines.length });
  }

  if (m === 'POST' && p === '/api/sample') {
    const t = rd('EXPENSE.TRANS'), add = [];
    const SAMPLE = [
      ['E0001001', '20261001', 'FOOD', 1250.5, 'Client lunch'], ['E0001002', '20261002', 'TRVL', 3400, 'Cab to site'], ['E0001003', '20261002', 'OFFC', 899, 'Printer toner'],
      ['E0001004', '20261003', 'MEDC', 640, 'Pharmacy'], ['E0001005', '20261004', 'UTIL', 2100, 'Electricity share'], ['E0001006', '20261005', 'TRNG', 7500, 'Training fee'],
      ['E0001001', '20261006', 'TRVL', 5200, 'Train tickets'], ['E0001002', '20261007', 'FOOD', 380, 'Team snacks'], ['E9999001', '20261003', 'FOOD', 450, 'Unknown employee'],
      ['E0001003', '20261341', 'OFFC', 899, 'Bad date'], ['E0001005', '20261004', 'XXXX', 250, 'Bad category'], ['E0001002', '20261006', 'UTIL', 0, 'Zero amount']
    ];
    SAMPLE.forEach(([emp, date, cat, amount, desc]) => add.push(makeRecord({ id: 'TX26' + String(t.length + add.length + 1).padStart(6, '0'), emp, date, cat, amount, desc })));
    add.push(add[0], add[3]);
    wr('EXPENSE.TRANS', t.concat(add));
    return send(res, 201, { added: add.length });
  }

  if (m === 'DELETE' && p === '/api/transactions') {
    FILES.filter(x => x !== 'EMPLOYEE.MASTER').forEach(x => { if (fs.existsSync(path.join(D, x))) fs.unlinkSync(path.join(D, x)); });
    return send(res, 200, { ok: true });
  }

  if (m === 'POST' && p === '/api/master') {
    const b = await readBody(req);
    if (!b.id || !b.name) return send(res, 400, { error: 'id and name are required' });
    const mm = rd('EMPLOYEE.MASTER');
    const { masterId } = require('../lib/pipeline');
    if (mm.some(r => masterId(r) === String(b.id).trim().toUpperCase())) return send(res, 409, { error: 'employee already exists' });
    const { makeMaster } = require('../lib/pipeline');
    mm.push(makeMaster(b.id, b.name));
    wr('EMPLOYEE.MASTER', mm);
    return send(res, 201, { ok: true });
  }

  return null;
}

module.exports = { handleExpenses };