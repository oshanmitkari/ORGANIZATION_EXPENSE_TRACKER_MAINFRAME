'use strict';
// Validate test fixtures and produce expected outputs for comparison
// Run: node practicals/TESTDATA/validate-fixtures.js
// Uses the SAME logic as the validator (DFSORT SORT + SUM FIELDS=NONE simulation)

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'TESTDATA');

function readFixtures(name) {
  return fs.readFileSync(path.join(DATA_DIR, name), 'utf8')
    .trim().split('\n').filter(Boolean);
}

function writeRecords(file, records) {
  fs.writeFileSync(path.join(DATA_DIR, file), records.join('\n') + '\n');
}

// Variant A: Full-record dedupe (matches validator)
// SORT FIELDS=(13,8,CH,A,1,80,CH,A) + SUM FIELDS=NONE
function variantA(records) {
  const sorted = [...records].sort((a, b) => {
    const keyA = a.slice(12, 20);
    const keyB = b.slice(12, 20);
    const keyCmp = keyA.localeCompare(keyB);
    if (keyCmp !== 0) return keyCmp;
    return a.localeCompare(b);
  });
  const result = [];
  let prev = null;
  for (const r of sorted) {
    if (r !== prev) {
      result.push(r);
      prev = r;
    }
  }
  return result;
}

// Variant B: Key-only dedupe (matches validator)
// SORT FIELDS=(13,8,CH,A),EQUALS + SUM FIELDS=NONE
function variantB(records) {
  const sorted = [...records].sort((a, b) => {
    const keyA = a.slice(12, 20);
    const keyB = b.slice(12, 20);
    return keyA.localeCompare(keyB);
  });
  const result = [];
  let prevKey = null;
  for (const r of sorted) {
    const key = r.slice(12, 20);
    if (key !== prevKey) {
      result.push(r);
      prevKey = key;
    }
  }
  return result;
}

// Fixture C: 100-byte full-record dedupe, sort by key (cols 25-32)
function variantC(records) {
  const sorted = [...records].sort((a, b) => {
    const keyA = a.slice(24, 32);
    const keyB = b.slice(24, 32);
    const keyCmp = keyA.localeCompare(keyB);
    if (keyCmp !== 0) return keyCmp;
    return a.localeCompare(b);
  });
  const result = [];
  let prev = null;
  for (const r of sorted) {
    if (r !== prev) {
      result.push(r);
      prev = r;
    }
  }
  return result;
}

// Fixture D: Full-record dedupe, sort by key (cols 13-20)
function variantDFull(records) {
  const sorted = [...records].sort((a, b) => {
    const keyA = a.slice(12, 20);
    const keyB = b.slice(12, 20);
    const keyCmp = keyA.localeCompare(keyB);
    if (keyCmp !== 0) return keyCmp;
    return a.localeCompare(b);
  });
  const result = [];
  let prev = null;
  for (const r of sorted) {
    if (r !== prev) {
      result.push(r);
      prev = r;
    }
  }
  return result;
}

// Fixture D: Key-only dedupe, sort by key (cols 13-20)
function variantDKey(records) {
  const sorted = [...records].sort((a, b) => {
    const keyA = a.slice(12, 20);
    const keyB = b.slice(12, 20);
    return keyA.localeCompare(keyB);
  });
  const result = [];
  let prevKey = null;
  for (const r of sorted) {
    const key = r.slice(12, 20);
    if (key !== prevKey) {
      result.push(r);
      prevKey = key;
    }
  }
  return result;
}

// Fixture A: 100 x 80-byte, full-record dedupe -> 90, then sort by key (cols 13-20)
const a = readFixtures('fixture_a_100_records.txt');
const expectedA = variantA(a);
writeRecords('expected_a_sorted_90.txt', expectedA);
console.log(`Fixture A: ${a.length} -> ${expectedA.length} (full-record dedupe) -> sorted by key`);

// Fixture B: 100 x 80-byte, key-only dedupe (cols 13-20) -> 90, then sort by key
const b = readFixtures('fixture_b_100_records.txt');
const expectedB = variantB(b);
writeRecords('expected_b_sorted_90.txt', expectedB);
console.log(`Fixture B: ${b.length} -> ${expectedB.length} (key-only dedupe) -> sorted by key`);

// Fixture C: 120 x 100-byte, full-record dedupe -> 105, then sort by key (cols 25-32)
const c = readFixtures('fixture_c_120_records.txt');
const expectedC = variantC(c);
writeRecords('expected_c_sorted_105.txt', expectedC);
console.log(`Fixture C: ${c.length} -> ${expectedC.length} (full-record dedupe) -> sorted by key`);

// Fixture D: 10 x 80-byte, demonstrate difference
const d = readFixtures('fixture_d_key_vs_full_dup.txt');
const expectedDFull = variantDFull(d);
const expectedDKey = variantDKey(d);
writeRecords('expected_d_full_sorted.txt', expectedDFull);
writeRecords('expected_d_key_sorted.txt', expectedDKey);
console.log(`Fixture D: ${d.length} -> full: ${expectedDFull.length}, key: ${expectedDKey.length}`);

console.log('\nExpected output files written to practicals/TESTDATA/');