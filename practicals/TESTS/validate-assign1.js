'use strict';
// Assignment 1 Local Validator (SIMULATED)
// Implements DFSORT SORT FIELDS + SUM FIELDS=NONE logic in Node.js
// Compares output against committed expected-output files

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'TESTDATA');

function readFixedRecords(file, lrecl) {
  const buf = fs.readFileSync(path.join(DATA_DIR, file));
  const records = [];
  for (let i = 0; i < buf.length; i += lrecl) {
    records.push(buf.slice(i, i + lrecl).toString('latin1'));
  }
  return records;
}

function writeFixedRecords(file, records, lrecl) {
  const buf = Buffer.alloc(records.length * lrecl);
  records.forEach((r, i) => {
    buf.write(r, i * lrecl, lrecl, 'latin1');
  });
  fs.writeFileSync(path.join(DATA_DIR, file), buf);
}

// Variant A: Full-record dedupe
// SORT FIELDS=(13,8,CH,A,1,80,CH,A) + SUM FIELDS=NONE
function variantA(records) {
  // Sort by key (cols 13-20) then full record
  const sorted = [...records].sort((a, b) => {
    const keyA = a.slice(12, 20); // 0-based: cols 13-20
    const keyB = b.slice(12, 20);
    const keyCmp = keyA.localeCompare(keyB);
    if (keyCmp !== 0) return keyCmp;
    return a.localeCompare(b); // full record compare
  });

  // SUM FIELDS=NONE: remove consecutive duplicates (full record match)
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

// Variant B: Key-only dedupe
// SORT FIELDS=(13,8,CH,A),EQUALS + SUM FIELDS=NONE
function variantB(records) {
  // Sort by key only (cols 13-20), stable (EQUALS preserves input order for ties)
  const sorted = [...records].sort((a, b) => {
    const keyA = a.slice(12, 20);
    const keyB = b.slice(12, 20);
    return keyA.localeCompare(keyB);
  });

  // SUM FIELDS=NONE on key: remove consecutive records with same key
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

function compareRecords(actual, expected, label) {
  if (actual.length !== expected.length) {
    console.log(`  ${label}: FAIL - count mismatch: ${actual.length} vs ${expected.length}`);
    return false;
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      console.log(`  ${label}: FAIL - record ${i} differs`);
      console.log(`    actual:   ${actual[i]}`);
      console.log(`    expected: ${expected[i]}`);
      return false;
    }
  }
  console.log(`  ${label}: PASS - ${actual.length} records match`);
  return true;
}

function main() {
  console.log('=== Assignment 1 Local Validator (SIMULATED) ===\n');

  // Load input fixtures (80-byte records)
  const fixtureA = readFixedRecords('fixture_a_100_records.txt', 80);
  const fixtureB = readFixedRecords('fixture_b_100_records.txt', 80);

  // Load expected outputs (80-byte records)
  const expectedA = readFixedRecords('expected_a_sorted_90.txt', 80);
  const expectedB = readFixedRecords('expected_b_sorted_90.txt', 80);

  // Run Variant A simulation
  console.log('Variant A (Full-record dedupe):');
  const outputA = variantA(fixtureA);
  writeFixedRecords('output_a_sorted_90.txt', outputA, 80);
  const passA = compareRecords(outputA, expectedA, 'Variant A');

  // Run Variant B simulation
  console.log('\nVariant B (Key-only dedupe):');
  const outputB = variantB(fixtureB);
  writeFixedRecords('output_b_sorted_90.txt', outputB, 80);
  const passB = compareRecords(outputB, expectedB, 'Variant B');

  // Summary
  console.log('\n=== Summary ===');
  if (passA && passB) {
    console.log('All validations PASSED');
    process.exit(0);
  } else {
    console.log('Some validations FAILED');
    process.exit(1);
  }
}

main();