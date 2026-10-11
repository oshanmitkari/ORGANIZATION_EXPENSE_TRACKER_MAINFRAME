'use strict';
const assert = require('assert');
const { makeRecord, makeMaster, run, validDate } = require('./lib/pipeline');
const master = [makeMaster('E0001001', 'A'), makeMaster('E0001002', 'B')];
const r = (id, emp, date, cat, amt) => makeRecord({ id, emp, date, cat, amount: amt, desc: 'x' });
const t = [
  r('T1', 'E0001002', '20261002', 'FOOD', 100),
  r('T2', 'E0001001', '20261001', 'TRVL', 500),
  r('T2', 'E0001001', '20261001', 'TRVL', 500), // exact duplicate
  r('T3', 'E9999999', '20261001', 'FOOD', 10), // unknown employee
  r('T4', 'E0001001', '20261341', 'FOOD', 10), // impossible date
  r('T5', 'E0001001', '20261001', 'ZZZZ', 10), // bad category
  r('T6', 'E0001001', '20261001', 'FOOD', 0) // zero amount
];
t.forEach(x => assert.strictEqual(x.length, 80));
assert.strictEqual(validDate('20240229'), true);
assert.strictEqual(validDate('20260229'), false);
assert.strictEqual(validDate('20261031'), true);
assert.strictEqual(validDate('20261032'), false);
const o = run(t, master, false);
assert.strictEqual(o.dups.length, 1);
assert.strictEqual(o.clean.length, 6);
assert.strictEqual(o.unknown.length, 1);
assert.strictEqual(o.rejected.length, 3);
assert.strictEqual(o.valid.length, 2);
assert.ok(Number(o.report[0].slice(32, 41)) >= Number(o.report[1].slice(32, 41)));
assert.ok(o.countOk && o.rc === 4, 'valid report with exceptions should return warning RC=4');
assert.strictEqual(o.categoryReport.length, 2);
assert.strictEqual(o.monthlyReport.length, 1);
assert.strictEqual(o.exceptions.length, 4);
assert.strictEqual(o.raw, o.malformed.length + o.dups.length + o.unknown.length + o.rejected.length + o.valid.length,
  'each fixed-width input must reconcile to duplicate, exception, or valid outcome');
const bad = run(t, master, true);
assert.ok(!bad.countOk && bad.rc === 12);
const malformed = run([r('SHORT', 'E0001001', '20261001', 'FOOD', 10).slice(0, 79)], master);
assert.strictEqual(malformed.malformed.length, 1);
assert.strictEqual(malformed.exceptions.length, 1);
assert.strictEqual(malformed.raw, malformed.malformed.length + malformed.dups.length + malformed.unknown.length + malformed.rejected.length + malformed.valid.length);
assert.throws(() => makeRecord({ id: 'TRANSACTION-ID-TOO-LONG', emp: 'E0001001', date: '20261001', cat: 'FOOD', amount: 10, desc: 'x' }), /exceeds/);
console.log('all tests passed');
