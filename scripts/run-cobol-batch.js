'use strict';
// Runs the COBOL batch from the command line (no web server, no login) and prints the job log.
//   npm run batch:cobol            normal run
//   npm run batch:cobol -- --break deliberately drop one report record (CNTCHECK must fail with RC 12)
const fs = require('fs');
const path = require('path');
const cobol = require('../lib/cobol');
const D = process.env.APP_DATA_DIR || path.join(__dirname, '..', 'data');
const rd = n => fs.existsSync(path.join(D, n)) ? fs.readFileSync(path.join(D, n), 'utf8').split(/\r?\n/).filter(Boolean) : [];
(async () => {
  const trans = rd('EXPENSE.TRANS'), master = rd('EMPLOYEE.MASTER');
  if (!trans.length) { console.error('data/EXPENSE.TRANS is empty'); process.exit(1); }
  try {
    const r = await cobol.runCobolPipeline(trans, master, process.argv.includes('--break'));
    console.log(r.jobLog);
    console.log('\nValid records written: ' + r.valid.length + ' | Exceptions: ' + r.exceptions.length + ' | Duplicates: ' + r.dups.length);
    process.exit(r.rc >= 12 ? 12 : 0);
  } catch (e) { console.error(e.message); (e.steps || []).forEach(s => console.error(`${s.step} ${s.program} RC=${s.rc} ${s.stdout || ''}`)); process.exit(1); }
})();
