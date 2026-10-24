'use strict';
const { run } = require('../lib/pipeline');
const cobol = require('../lib/cobol');
const { recordBatch } = require('../lib/workflow');
const fs = require('fs');
const path = require('path');

async function handleBatch(req, res, url, readBody, send, rd, wr, FILES, actor, D) {
  const p = url.pathname, m = req.method;

  if (m === 'GET' && p === '/api/state') {
    return send(res, 200, { trans: rd('EXPENSE.TRANS'), master: rd('EMPLOYEE.MASTER'), files: FILES.filter(f => fs.existsSync(path.join(D, f))) });
  }

  if (m === 'GET' && p === '/api/cobol/status') return send(res, 200, await cobol.status());

  if (m === 'POST' && p === '/api/run') {
    const b = await readBody(req), trans = rd('EXPENSE.TRANS');
    if (!trans.length) return send(res, 400, { error: 'EXPENSE.TRANS is empty - add some transactions first' });
    const engine = String(b.engine || 'cobol').toLowerCase();
    if (!['cobol', 'js'].includes(engine)) return send(res, 400, { error: "engine must be 'cobol' or 'js'" });
    let r;
    if (engine === 'cobol') {
      // The batch is executed by the COBOL programs in /mainframe (compiled with GnuCOBOL on first use).
      try { r = await cobol.runCobolPipeline(trans, rd('EMPLOYEE.MASTER'), !!b.breakCount); }
      catch (e) { return send(res, e.status || 500, { error: e.message, steps: e.steps || [] }); }
    } else {
      r = run(trans, rd('EMPLOYEE.MASTER'), !!b.breakCount); // legacy Node simulator, only when explicitly requested
      r.engine = 'JS_SIMULATOR'; r.steps = []; r.jobLog = 'Node.js simulator was used. No COBOL program was executed.';
    }
    wr('EXPENSE.DUPS', r.dups); wr('EXPENSE.CLEAN', r.clean); wr('EXPENSE.MATCHED', r.matched); wr('EXPENSE.VALID', r.valid); wr('EXPENSE.REJECT', r.exceptions); wr('EXPENSE.CATEGORY', r.categoryReport); wr('EXPENSE.MONTHLY', r.monthlyReport); wr('EXPENSE.AUDIT', r.audit); wr('EXPENSE.CHECKPOINT', r.checkpoints);
    if (r.countOk) wr('EXPENSE.REPORT', r.report); else if (fs.existsSync(path.join(D, 'EXPENSE.REPORT'))) fs.unlinkSync(path.join(D, 'EXPENSE.REPORT'));
    r.message = r.countOk ? `RECORD COUNTS MATCH (${r.countBefore}) - REPORT KEPT` : `ERROR - RECORD COUNT MISMATCH (${r.countBefore} vs ${r.countAfter}) - REPORT DELETED`;
    const run_ = recordBatch(r, actor);
    r.runId = run_.id;
    return send(res, 200, r);
  }

  const file = p.match(/^\/api\/file\/([A-Z.]+)$/);
  if (m === 'GET' && file && FILES.includes(file[1])) {
    return fs.existsSync(path.join(D, file[1])) ? send(res, 200, fs.readFileSync(path.join(D, file[1]), 'utf8'), 'text/plain; charset=utf-8') : send(res, 404, { error: 'dataset not found' });
  }

  return null;
}

module.exports = { handleBatch };