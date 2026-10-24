'use strict';
// Assignment 2 fixture generator: 50 transactions + 50 employee master records
// Known match count: 35 matched, 15 unmatched

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'TESTDATA');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Deterministic PRNG
let seed = 42424242;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed;
}
function rndInt(max) { return rnd() % max; }
function pick(arr) { return arr[rndInt(arr.length)]; }

const pad = (s, n) => String(s == null ? '' : s).slice(0, n).padEnd(n, ' ');
const padNum = (n, width) => String(n).padStart(width, '0');

// 80-byte transaction record (cols 13-20 = employee ID)
function buildTrans80({ id, emp, date, cat, amount, desc }) {
  const cents = Math.round(amount * 100);
  return pad(id, 12) + pad(emp, 8) + pad(date, 8) + pad(cat, 4) + padNum(cents, 9) + pad(desc, 39);
}

// 80-byte employee master record (cols 21-28 = employee ID)
// Layout: 1-20 filler, 21-28 emp ID, 29-80 rest (52 bytes)
function buildMaster80({ emp, name, dept, hireDate, status }) {
  const rest = pad(name, 20) + pad(dept, 8) + pad(hireDate, 8) + pad(status, 1) + pad('', 15);
  return pad('', 20) + pad(emp, 8) + rest;
}

function randomDate() {
  const year = 2024 + rndInt(3);
  const month = 1 + rndInt(12);
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = 1 + rndInt(daysInMonth);
  return `${year}${padNum(month, 2)}${padNum(day, 2)}`;
}

const CATS = ['FOOD', 'TRVL', 'OFFC', 'MEDC', 'UTIL', 'TRNG'];
const DESCS = [
  'Client lunch meeting', 'Cab to client site', 'Printer toner cartridge',
  'Pharmacy prescription', 'Electricity bill share', 'Training course fee',
  'Train tickets', 'Team snacks', 'Office supplies', 'Medical checkup',
  'Internet reimbursement', 'Conference registration'
];

// We want exactly 35 matches out of 50 transactions
// Create 35 employees that exist in both, 15 that only exist in transactions
const matchedEmps = Array.from({length: 35}, (_, i) => `E${padNum(1001 + i, 7)}`); // E0001001-E0001035
const unmatchedEmps = Array.from({length: 15}, (_, i) => `E${padNum(2001 + i, 7)}`); // E0002001-E0002015
const masterOnlyEmps = Array.from({length: 15}, (_, i) => `E${padNum(3001 + i, 7)}`); // E0003001-E0003015 (in master but no trans)

// All master employees = matched + masterOnly = 50
const allMasterEmps = [...matchedEmps, ...masterOnlyEmps];

// Generate 50 transactions: 35 with matchedEmps, 15 with unmatchedEmps
const transactions = [];
for (let i = 0; i < 35; i++) {
  transactions.push(buildTrans80({
    id: `TX${padNum(i + 1, 10)}`,
    emp: matchedEmps[i],
    date: randomDate(),
    cat: pick(CATS),
    amount: 1 + rndInt(50000) / 100,
    desc: pick(DESCS)
  }));
}
for (let i = 0; i < 15; i++) {
  transactions.push(buildTrans80({
    id: `TX${padNum(36 + i, 10)}`,
    emp: unmatchedEmps[i],
    date: randomDate(),
    cat: pick(CATS),
    amount: 1 + rndInt(50000) / 100,
    desc: pick(DESCS)
  }));
}

// Shuffle transactions
for (let i = transactions.length - 1; i > 0; i--) {
  const j = rndInt(i + 1);
  [transactions[i], transactions[j]] = [transactions[j], transactions[i]];
}

// Generate 50 master records
const master = [];
const depts = ['FINANCE', 'OPS    ', 'IT     ', 'HR     ', 'SALES  ', 'MKTG   '];
const statuses = ['A', 'A', 'A', 'A', 'I']; // mostly active

for (let i = 0; i < allMasterEmps.length; i++) {
  master.push(buildMaster80({
    emp: allMasterEmps[i],
    name: `Employee ${padNum(i + 1, 4)}`,
    dept: pick(depts),
    hireDate: `${2020 + rndInt(5)}${padNum(1 + rndInt(12), 2)}${padNum(1 + rndInt(28), 2)}`,
    status: pick(statuses)
  }));
}

// Shuffle master
for (let i = master.length - 1; i > 0; i--) {
  const j = rndInt(i + 1);
  [master[i], master[j]] = [master[j], master[i]];
}

// Verify
transactions.forEach((r, i) => { if (r.length !== 80) throw new Error(`Trans ${i} len ${r.length}`); });
master.forEach((r, i) => { if (r.length !== 80) throw new Error(`Master ${i} len ${r.length}`); });

fs.writeFileSync(path.join(OUT_DIR, 'assign2_trans50.txt'), Buffer.from(transactions.join('')));
fs.writeFileSync(path.join(OUT_DIR, 'assign2_master50.txt'), Buffer.from(master.join('')));

console.log('Generated Assignment 2 fixtures:');
console.log(`  assign2_trans50.txt: ${transactions.length} records (80 bytes)`);
console.log(`  assign2_master50.txt: ${master.length} records (80 bytes)`);
console.log('Expected: 35 matched, 15 unmatched (RC=4)');