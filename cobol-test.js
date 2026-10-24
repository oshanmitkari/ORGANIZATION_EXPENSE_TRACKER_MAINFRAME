'use strict';
// Verifies that the COBOL programs (run through lib/cobol.js) produce exactly the same
// results as the reference Node implementation in lib/pipeline.js.
const assert = require('assert');
const { run, makeMaster, pad } = require('./lib/pipeline');
const cobol = require('./lib/cobol');

// Build an 80-byte record from raw field text (lets us create deliberately broken fields).
const rec = (id, emp, date, cat, amt, desc = 'test') => pad(id, 12) + pad(emp, 8) + pad(date, 8) + pad(cat, 4) + pad(amt, 9) + pad(desc, 39);
const cents = n => String(n).padStart(9, '0');
let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const pick = a => a[rnd(a.length)];

async function main() {
  const info = await cobol.compilerInfo();
  if (!info.available) { console.log('SKIPPED cobol-test: ' + info.reason); return; }
  const log = await cobol.build({ force: true });
  assert.ok(log.every(x => x.status === 'compiled'), 'all programs compile');
  console.log('compiled with ' + info.version + ': ' + log.map(x => x.program).join(', '));

  const master = ['E0001001', 'E0001002', 'E0001003', 'E0001004', 'E0001005', 'E0001006'].map((id, i) => makeMaster(id, 'Employee ' + i));
  const dates = ['20260115', '20260228', '20260229', '20240229', '20230229', '20000229', '19000229', '18991231', '20261341', '20260431', '20261001', '2026O101', '20260000', '20260100', '20251231'];
  const cats = ['FOOD', 'TRVL', 'OFFC', 'MEDC', 'UTIL', 'TRNG', 'XXXX', 'food', '    '];
  const emps = ['E0001001', 'E0001002', 'E0001003', 'E0001004', 'E0001005', 'E0001006', 'E9999999', 'E0001007'];
  const amts = [() => cents(1 + rnd(500000)), () => cents(1 + rnd(999999999)), () => '000000000', () => '12AB56789', () => cents(5000)];
  const trans = [];
  for (let i = 0; i < 300; i++) {
    trans.push(rec('TX' + String(i).padStart(6, '0'), pick(emps), pick(dates), pick(cats), pick(amts)(), 'item ' + i));
    if (rnd(6) === 0) trans.push(trans[trans.length - 1]); // exact duplicate
  }
  trans.forEach(t => assert.strictEqual(t.length, 80));

  for (const brk of [false, true]) {
    const js = run(trans, master, brk), c = await cobol.runCobolPipeline(trans, master, brk);
    assert.strictEqual(c.engine, 'COBOL');
    assert.deepStrictEqual([...c.dups].sort(), [...js.dups].sort(), 'duplicates');
    assert.deepStrictEqual(c.clean, js.clean, 'sorted unique records');
    assert.deepStrictEqual(c.matched, js.matched, 'employee matching');
    assert.deepStrictEqual(c.unknown.map(x => x[0]), js.unknown.map(x => x[0]), 'unknown employees');
    assert.deepStrictEqual(c.valid, js.valid, 'validation (good records)');
    assert.deepStrictEqual(c.rejected.map(x => x[0]), js.rejected.map(x => x[0]), 'validation (rejected records)');
    assert.deepStrictEqual(c.report, js.report, 'report sorted by amount');
    assert.deepStrictEqual(c.categoryReport, js.categoryReport, 'category totals');
    assert.deepStrictEqual(c.monthlyReport, js.monthlyReport, 'monthly totals');
    assert.strictEqual(c.countOk, js.countOk); assert.strictEqual(c.rc, js.rc);
    assert.ok(c.rejected.every(x => x[1].length > 0), 'every rejection has a reason');
    assert.strictEqual(c.steps.length, 7, 'ingest + 6 COBOL steps');
    assert.ok(c.steps.slice(1).every(s => typeof s.rc === 'number'));
    console.log(`parity with Node reference OK (breakCount=${brk}): ${trans.length} in, ${c.clean.length} unique, ${c.valid.length} valid, rc=${c.rc}`);
  }

  // Edge: empty employee master -> every record unknown, nothing valid, report empty but counts agree.
  const five = [1, 2, 3, 4, 5].map(i => rec('D' + i, 'E0001001', '20261001', 'FOOD', cents(i * 100)));
  const noMaster = await cobol.runCobolPipeline(five, [], false);
  assert.strictEqual(noMaster.valid.length, 0); assert.strictEqual(noMaster.unknown.length, 5);
  assert.ok(noMaster.countOk && noMaster.rc === 4);
  assert.ok(noMaster.unknown.every(x => x[1] === 'EMPTY EMPLOYEE MASTER'));

  // Edge: nothing valid -> empty report passes count check (0 = 0).
  const allBad = await cobol.runCobolPipeline([rec('A1', 'E0001001', '20261341', 'FOOD', cents(10))], master, false);
  assert.strictEqual(allBad.valid.length, 0); assert.ok(allBad.countOk); assert.strictEqual(allBad.rc, 4);

  // Edge: single valid record + deliberate break -> report 0 vs valid 1 -> CNTCHECK fails with RC 12.
  const one = await cobol.runCobolPipeline([rec('B1', 'E0001001', '20261001', 'FOOD', cents(10))], master, true);
  assert.ok(!one.countOk); assert.strictEqual(one.rc, 12); assert.strictEqual(one.countBefore, 1); assert.strictEqual(one.countAfter, 0);
  assert.strictEqual(one.steps[one.steps.length - 1].rc, 12);

  // Malformed (short) records are quarantined before COBOL runs and counted as exceptions.
  const mal = await cobol.runCobolPipeline([rec('C1', 'E0001001', '20261001', 'FOOD', cents(10)).slice(0, 79)], master, false);
  assert.strictEqual(mal.malformed.length, 1); assert.strictEqual(mal.exceptions.length, 1);

  console.log('all COBOL tests passed');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
