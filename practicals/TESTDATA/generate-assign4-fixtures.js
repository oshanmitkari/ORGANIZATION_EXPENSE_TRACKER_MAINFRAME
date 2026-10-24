'use strict';
// Assignment 4 fixture generator: validated expense records for sorting
// Two test cases: SUCCESS (counts match) and FAILURE (mismatch)

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'TESTDATA');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Deterministic PRNG
let seed = 77777777;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed;
}
function rndInt(max) { return rnd() % max; }
function pick(arr) { return arr[rndInt(arr.length)]; }

const pad = (s, n) => String(s == null ? '' : s).slice(0, n).padEnd(n, ' ');
const padNum = (n, width) => String(n).padStart(width, '0');

// 80-byte transaction record (matches EXPENSE-REC.cpy)
function buildRecord80({ id, emp, date, cat, amount, desc }) {
  const cents = Math.round(amount * 100);
  return pad(id, 12) + pad(emp, 8) + pad(date, 8) + pad(cat, 4) + padNum(cents, 9) + pad(desc, 39);
}

function randomDate() {
  const year = 2024 + rndInt(3);
  const month = 1 + rndInt(12);
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = 1 + rndInt(daysInMonth);
  return `${year}${padNum(month, 2)}${padNum(day, 2)}`;
}

const CATS = ['FOOD', 'TRVL', 'OFFC', 'MEDC', 'UTIL', 'TRNG'];
const EMPS = ['E0001001', 'E0001002', 'E0001003', 'E0001004', 'E0001005', 'E0001006'];
const DESCS = [
  'Client lunch meeting', 'Cab to client site', 'Printer toner cartridge',
  'Pharmacy prescription', 'Electricity bill share', 'Training course fee',
  'Train tickets', 'Team snacks', 'Office supplies', 'Medical checkup',
  'Internet reimbursement', 'Conference registration'
];

// SUCCESS case: 20 records, sort descending by amount, counts should match
seed = 77777777;
const successRecords = [];
for (let i = 0; i < 20; i++) {
  successRecords.push(buildRecord80({
    id: `TX${padNum(i + 1, 10)}`,
    emp: pick(EMPS),
    date: randomDate(),
    cat: pick(CATS),
    amount: 10 + rndInt(50000) / 100, // 10.00 to 510.00
    desc: pick(DESCS)
  }));
}
fs.writeFileSync(path.join(OUT_DIR, 'assign4_valid_input.txt'), Buffer.from(successRecords.join('')));

// Create expected output (sorted descending by amount cols 33-41)
const successSorted = [...successRecords].sort((a, b) => {
  const amtA = a.slice(32, 41); // 0-based: cols 33-41
  const amtB = b.slice(32, 41);
  return amtB.localeCompare(amtA); // descending
});
fs.writeFileSync(path.join(OUT_DIR, 'assign4_expected_success.txt'), Buffer.from(successSorted.join('')));

// FAILURE case: create a truncated version (19 records) to simulate mismatch
// This simulates a SORT that dropped a record
const failureRecords = successRecords.slice(0, 19); // Remove last record
fs.writeFileSync(path.join(OUT_DIR, 'assign4_truncated_output.txt'), Buffer.from(failureRecords.join('')));

console.log('Generated Assignment 4 fixtures:');
console.log(`  assign4_valid_input.txt: ${successRecords.length} records (80 bytes)`);
console.log(`  assign4_expected_success.txt: ${successSorted.length} records (80 bytes)`);
console.log(`  assign4_truncated_output.txt: ${failureRecords.length} records (80 bytes)`);
console.log('SUCCESS test: input=20, sorted output=20 -> VALIDCNT RC=0');
console.log('FAILURE test: input=20, truncated output=19 -> VALIDCNT RC=12');