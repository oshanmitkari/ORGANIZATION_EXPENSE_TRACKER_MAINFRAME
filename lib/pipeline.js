'use strict';
// Local demonstration of the project's mainframe batch rules. This simulates PS datasets;
// it does not connect to z/OS, VSAM, DB2 or RACF.
const CATS = ['FOOD', 'TRVL', 'OFFC', 'MEDC', 'UTIL', 'TRNG'];
const pad = (s, n) => String(s == null ? '' : s).slice(0, n).padEnd(n, ' ');
const key = r => r.slice(12, 20).trim();
const amountCents = r => Number(r.slice(32, 41));
function makeRecord({ id, emp, date, cat, amount, desc }) {
  const textFields = [id, emp, date, cat, desc].map(v => String(v == null ? '' : v));
  if (textFields.some(v => /[^\x20-\x7E]/.test(v)) || Buffer.byteLength(textFields[0], 'utf8') > 12 || Buffer.byteLength(textFields[1].trim(), 'utf8') > 8 || Buffer.byteLength(textFields[4], 'utf8') > 39)
    throw new Error('transaction ID, employee ID, or description exceeds the fixed-width record limit');
  const n = Number(amount);
  const cents = Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
  const amt = Number.isInteger(cents) && cents <= 999999999 ? String(cents).padStart(9, '0') : 'XXXXXXXXX';
  return pad(id, 12) + pad(String(emp || '').trim().toUpperCase(), 8) +
    pad(String(date || '').replace(/-/g, '').replace(/\D/g, ''), 8) +
    pad(String(cat || '').trim().toUpperCase(), 4) + amt + pad(desc || '', 39);
}
const makeMaster = (id, name) => pad('IT', 20) + pad(String(id || '').trim().toUpperCase(), 8) + pad(name, 52);
const masterId = m => m.slice(20, 28).trim();
function validDate(d) {
  if (!/^\d{8}$/.test(d)) return false;
  const y = Number(d.slice(0, 4)), m = Number(d.slice(4, 6)), day = Number(d.slice(6, 8));
  if (y < 1900 || m < 1 || m > 12 || day < 1) return false;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return day <= days;
}
function recordIssue(r) {
  const date = r.slice(20, 28), cat = r.slice(28, 32), rawAmt = r.slice(32, 41);
  if (!/^\d{9}$/.test(rawAmt)) return 'amount is not a 9-digit numeric field';
  if (Number(rawAmt) <= 0) return 'amount must be greater than zero';
  if (!validDate(date)) return 'invalid calendar date';
  if (!CATS.includes(cat)) return 'unknown category code';
  return '';
}
function run(trans, master, breakCount = false) {
  const malformed = [], safeTrans = [];
  for (const source of trans) {
    const raw = String(source).replace(/[\r\n]/g, '');
    if (Buffer.byteLength(raw, 'utf8') !== 80 || /[^\x20-\x7E]/.test(raw)) malformed.push([raw.slice(0, 80).padEnd(80, ' '), `record length/encoding invalid; expected 80 single-byte printable characters`]);
    else safeTrans.push(raw);
  }
  const seen = new Set(), dups = [], unique = [];
  for (const r of safeTrans) { if (seen.has(r)) dups.push(r); else { seen.add(r); unique.push(r); } }
  const clean = unique.slice().sort((a, b) => key(a).localeCompare(key(b)) || a.localeCompare(b));
  const ids = new Set(master.map(masterId));
  const matched = [], unknown = [];
  for (const r of clean) (ids.has(key(r)) ? matched : unknown).push(...(ids.has(key(r)) ? [r] : [[r, 'employee not in master']]));
  const valid = [], rejected = [];
  for (const r of matched) { const why = recordIssue(r); if (why) rejected.push([r, why]); else valid.push(r); }
  const reportAll = valid.slice().sort((a, b) => amountCents(b) - amountCents(a) || a.localeCompare(b));
  const report = breakCount ? reportAll.slice(0, Math.max(0, reportAll.length - 1)) : reportAll;
  const countOk = reportAll.length === report.length;
  const categoryTotals = new Map(), monthlyTotals = new Map();
  for (const r of valid) {
    const cents = amountCents(r), cat = r.slice(28, 32), month = r.slice(20, 26);
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + cents);
    monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + cents);
  }
  const summaryRecord = (label, cents, count) => pad(label, 32) + String(cents).padStart(12, '0') + String(count).padStart(8, '0') + pad('', 28);
  const categoryReport = [...categoryTotals].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => summaryRecord('CATEGORY ' + k, v, valid.filter(r => r.slice(28, 32) === k).length));
  const monthlyReport = [...monthlyTotals].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => summaryRecord('MONTH ' + k, v, valid.filter(r => r.slice(20, 26) === k).length));
  const exceptions = malformed.concat(unknown, rejected).map(([r, why]) => pad(r, 80) + pad(why, 30));
  const checkpoints = [
    `01 INPUT_READ COMPLETE COUNT=${trans.length} MALFORMED=${malformed.length}`, `02 DEDUPLICATION COMPLETE COUNT=${clean.length}`,
    `03 EMPLOYEE_MATCH COMPLETE MATCHED=${matched.length} UNKNOWN=${unknown.length}`,
    `04 VALIDATION COMPLETE APPROVED=${valid.length} REJECTED=${rejected.length}`,
    `05 REPORT_SORT COMPLETE COUNT=${report.length}`,
    `06 COUNT_CHECK ${countOk ? 'PASS' : 'FAIL'}`
  ].map(s => pad(s, 80));
  const audit = [
    `RAW=${trans.length}`, `MALFORMED=${malformed.length}`, `DUPLICATES=${dups.length}`, `CLEAN=${clean.length}`,
    `UNKNOWN_EMPLOYEE=${unknown.length}`, `VALIDATION_REJECTED=${rejected.length}`,
    `APPROVED=${valid.length}`, `REPORT_BEFORE=${reportAll.length}`, `REPORT_AFTER=${report.length}`,
    `COUNT_CHECK=${countOk ? 'PASS' : 'FAIL'}`, `RETURN_CODE=${countOk ? (exceptions.length ? 4 : 0) : 12}`
  ].map(s => pad(s, 80));
  return { raw: trans.length, malformed, dups, clean, unknown, matched, valid, rejected, report, reportAll,
    categoryReport, monthlyReport, exceptions, audit, checkpoints, countBefore: reportAll.length, countAfter: report.length,
    countOk, rc: countOk ? (exceptions.length ? 4 : 0) : 12 };
}
module.exports = { CATS, pad, makeRecord, makeMaster, masterId, validDate, recordIssue, run };
