'use strict';
// Deterministic test fixture generator for practicals
// Run: node practicals/TESTDATA/generate-fixtures.js

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'TESTDATA');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Deterministic PRNG (Linear Congruential Generator)
let seed = 123456789;
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed;
}
function rndInt(max) {
  return rnd() % max;
}
function pick(arr) {
  return arr[rndInt(arr.length)];
}

const pad = (s, n) => String(s == null ? '' : s).slice(0, n).padEnd(n, ' ');
const padNum = (n, width) => String(n).padStart(width, '0');

// Valid categories from existing layout
const CATS = ['FOOD', 'TRVL', 'OFFC', 'MEDC', 'UTIL', 'TRNG'];
const EMPLOYEES = ['E0001001', 'E0001002', 'E0001003', 'E0001004', 'E0001005', 'E0001006'];
// For fixture B, we need many unique keys - generate synthetic ones
const EXTENDED_EMPLOYEES = Array.from({length: 100}, (_, i) => `E${padNum(i + 1, 7)}`);
const COST_CENTRES = ['ACS-100', 'ACS-200', 'ACS-300', 'FIN-100', 'OPS-100', 'IT-100'];
const DESCS = [
  'Client lunch meeting',
  'Cab to client site',
  'Printer toner cartridge',
  'Pharmacy prescription',
  'Electricity bill share',
  'Training course fee',
  'Train tickets',
  'Team snacks',
  'Office supplies',
  'Medical checkup',
  'Internet reimbursement',
  'Conference registration'
];

// ============================================================
// 80-byte record builder (matches EXPENSE-REC.cpy)
// ============================================================
function buildRecord80({ id, emp, date, cat, amount, desc }) {
  const cents = Math.round(amount * 100);
  return pad(id, 12) +
         pad(emp, 8) +
         pad(date, 8) +
         pad(cat, 4) +
         padNum(cents, 9) +
         pad(desc, 39);
}

// ============================================================
// 100-byte record builder (matches EXPENSE-EXT-REC.cpy)
// Key at columns 25-32 (1-based) = EXT-EMP-ID
// ============================================================
function buildRecord100({ id, costCentre, emp, date, cat, amount, desc }) {
  const cents = Math.round(amount * 100);
  return pad(id, 12) +
         pad(costCentre, 12) +
         pad(emp, 8) +
         pad(date, 8) +
         pad(cat, 4) +
         padNum(cents, 9) +
         pad(desc, 47);
}

// ============================================================
// Generate valid random date (YYYYMMDD)
// ============================================================
function randomDate() {
  const year = 2024 + rndInt(3); // 2024-2026
  const month = 1 + rndInt(12);
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = 1 + rndInt(daysInMonth);
  return `${year}${padNum(month, 2)}${padNum(day, 2)}`;
}

// ============================================================
// FIXTURE A: 100 x 80-byte records
// 90 unique valid + 10 exact duplicates
// ============================================================
function generateFixtureA() {
  seed = 123456789; // Fixed seed for determinism
  const records = [];
  const uniqueRecords = new Map(); // key = full 80-byte record

  // Generate 90 unique records
  while (records.length < 90) {
    const rec = buildRecord80({
      id: `TX${padNum(records.length + 1, 10)}`,
      emp: pick(EMPLOYEES),
      date: randomDate(),
      cat: pick(CATS),
      amount: 1 + rndInt(50000) / 100, // 0.01 to 500.00
      desc: pick(DESCS)
    });
    if (!uniqueRecords.has(rec)) {
      uniqueRecords.set(rec, true);
      records.push(rec);
    }
  }

  // Add 10 exact duplicates (pick from existing)
  const uniqueList = Array.from(uniqueRecords.keys());
  for (let i = 0; i < 10; i++) {
    records.push(pick(uniqueList));
  }

  // Shuffle deterministically (Fisher-Yates)
  for (let i = records.length - 1; i > 0; i--) {
    const j = rndInt(i + 1);
    [records[i], records[j]] = [records[j], records[i]];
  }

  // Verify: 100 records, each 80 bytes
  records.forEach((r, i) => {
    if (r.length !== 80) throw new Error(`Fixture A record ${i} length ${r.length}`);
  });

  return records;
}

// ============================================================
// FIXTURE B: 100 x 80-byte records
// 100 records with unique keys (cols 13-20) except 10 repeats
// Tests KEY-only deduplication vs FULL-RECORD deduplication
// 90 unique keys, 10 records duplicate those keys (different data)
// ============================================================
function generateFixtureB() {
  seed = 987654321; // Different fixed seed
  const records = [];

  // Generate 90 unique keys
  const uniqueKeys = new Set();
  while (uniqueKeys.size < 90) {
    const emp = `E${padNum(rndInt(9000000) + 1000000, 7)}`; // E1000000-E9999999
    uniqueKeys.add(emp);
  }
  const keyArray = Array.from(uniqueKeys);

  // Create 90 records with unique keys
  for (const emp of keyArray) {
    records.push(buildRecord80({
      id: `TX${padNum(records.length + 1, 10)}`,
      emp: emp,
      date: randomDate(),
      cat: pick(CATS),
      amount: 1 + rndInt(50000) / 100,
      desc: pick(DESCS)
    }));
  }

  // Add 10 records that duplicate existing keys (different data)
  for (let i = 0; i < 10; i++) {
    const emp = keyArray[rndInt(keyArray.length)];
    records.push(buildRecord80({
      id: `TX${padNum(records.length + 1, 10)}`,
      emp: emp,
      date: randomDate(),
      cat: pick(CATS),
      amount: 1 + rndInt(50000) / 100,
      desc: pick(DESCS)
    }));
  }

  // Shuffle
  for (let i = records.length - 1; i > 0; i--) {
    const j = rndInt(i + 1);
    [records[i], records[j]] = [records[j], records[i]];
  }

  records.forEach((r, i) => {
    if (r.length !== 80) throw new Error(`Fixture B record ${i} length ${r.length}`);
  });

  return records;
}

// ============================================================
// FIXTURE C: 120 x 100-byte records
// 105 unique + 15 exact duplicates
// Key at columns 25-32 (EXT-EMP-ID)
// ============================================================
function generateFixtureC() {
  seed = 555555555; // Fixed seed
  const records = [];
  const uniqueRecords = new Map();

  while (records.length < 105) {
    const rec = buildRecord100({
      id: `TX${padNum(records.length + 1, 10)}`,
      costCentre: pick(COST_CENTRES),
      emp: pick(EMPLOYEES),
      date: randomDate(),
      cat: pick(CATS),
      amount: 1 + rndInt(50000) / 100,
      desc: pick(DESCS)
    });
    if (!uniqueRecords.has(rec)) {
      uniqueRecords.set(rec, true);
      records.push(rec);
    }
  }

  const uniqueList = Array.from(uniqueRecords.keys());
  for (let i = 0; i < 15; i++) {
    records.push(pick(uniqueList));
  }

  // Shuffle
  for (let i = records.length - 1; i > 0; i--) {
    const j = rndInt(i + 1);
    [records[i], records[j]] = [records[j], records[i]];
  }

  records.forEach((r, i) => {
    if (r.length !== 100) throw new Error(`Fixture C record ${i} length ${r.length}`);
  });

  return records;
}

// ============================================================
// FIXTURE D: Key-dup vs Full-dup difference demonstration
// Small dataset showing where the two definitions diverge
// ============================================================
function generateFixtureD() {
  seed = 111111111;
  const records = [];

  // 3 records with SAME employee ID (key) but DIFFERENT data
  // Full-record dedupe: keeps all 3 (different records)
  // Key-only dedupe: keeps 1 (first by sort order)
  const baseEmp = 'E0001001';
  const baseDate = '20260115';
  const baseCat = 'FOOD';

  records.push(buildRecord80({ id: 'TX0000000001', emp: baseEmp, date: baseDate, cat: baseCat, amount: 100.00, desc: 'Lunch meeting A' }));
  records.push(buildRecord80({ id: 'TX0000000002', emp: baseEmp, date: baseDate, cat: baseCat, amount: 200.00, desc: 'Lunch meeting B' }));
  records.push(buildRecord80({ id: 'TX0000000003', emp: baseEmp, date: baseDate, cat: baseCat, amount: 300.00, desc: 'Lunch meeting C' }));

  // 2 exact duplicates of first record
  records.push(buildRecord80({ id: 'TX0000000001', emp: baseEmp, date: baseDate, cat: baseCat, amount: 100.00, desc: 'Lunch meeting A' }));
  records.push(buildRecord80({ id: 'TX0000000001', emp: baseEmp, date: baseDate, cat: baseCat, amount: 100.00, desc: 'Lunch meeting A' }));

  // 5 unique other records
  for (let i = 0; i < 5; i++) {
    records.push(buildRecord80({
      id: `TX00000000${10 + i}`,
      emp: EMPLOYEES[i + 1],
      date: randomDate(),
      cat: pick(CATS),
      amount: 100 + i * 50,
      desc: pick(DESCS)
    }));
  }

  // Shuffle
  for (let i = records.length - 1; i > 0; i--) {
    const j = rndInt(i + 1);
    [records[i], records[j]] = [records[j], records[i]];
  }

  records.forEach((r, i) => {
    if (r.length !== 80) throw new Error(`Fixture D record ${i} length ${r.length}`);
  });

  return records;
}

// ============================================================
// Write fixtures
// ============================================================
const fixtureA = generateFixtureA();
const fixtureB = generateFixtureB();
const fixtureC = generateFixtureC();
const fixtureD = generateFixtureD();

fs.writeFileSync(path.join(OUT_DIR, 'fixture_a_100_records.txt'), Buffer.from(fixtureA.join('')));
fs.writeFileSync(path.join(OUT_DIR, 'fixture_b_100_records.txt'), Buffer.from(fixtureB.join('')));
fs.writeFileSync(path.join(OUT_DIR, 'fixture_c_120_records.txt'), Buffer.from(fixtureC.join('')));
fs.writeFileSync(path.join(OUT_DIR, 'fixture_d_key_vs_full_dup.txt'), Buffer.from(fixtureD.join('')));

console.log('Generated fixtures:');
console.log(`  fixture_a_100_records.txt: ${fixtureA.length} records (80 bytes each)`);
console.log(`  fixture_b_100_records.txt: ${fixtureB.length} records (80 bytes each)`);
console.log(`  fixture_c_120_records.txt: ${fixtureC.length} records (100 bytes each)`);
console.log(`  fixture_d_key_vs_full_dup.txt: ${fixtureD.length} records (80 bytes each)`);

// Expected outputs for validation
// Fixture A: 90 unique after full-record dedupe (regardless of key)
// Fixture B: 90 unique after key-only dedupe (10 key duplicates removed)
// Fixture C: 105 unique after full-record dedupe (15 exact duplicates removed)
// Fixture D: Full-record dedupe -> 8 records (3 same-key-diff-data + 2 exact-dup-of-first + 5 unique)
//            Key-only dedupe -> 6 records (1 of the 3 same-key + 5 unique)

console.log('\nExpected results:');
console.log('  Fixture A (full-record dedupe): 90 records');
console.log('  Fixture B (key-only dedupe): 90 records');
console.log('  Fixture C (full-record dedupe, 100-byte): 105 records');
console.log('  Fixture D (full-record): 8 records, (key-only): 6 records');