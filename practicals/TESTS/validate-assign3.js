'use strict';
// Assignment 3 Local Validator (SIMULATED)
// Implements REXX exact dedupe + merge sort logic in Node.js
// For 100-byte records with key at columns 25-32 (1-based)

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

// Simulated REXX algorithm: exact dedupe + merge sort
function simulateAssign3(records, keyStart, keyLen, expectedOut) {
  const keyStart0 = keyStart - 1;

  const seen = new Set();
  const unique = [];
  for (const rec of records) {
    if (!seen.has(rec)) {
      seen.add(rec);
      unique.push(rec);
    }
  }
  const dupCount = records.length - unique.length;

  const n = unique.length;
  const u = [...unique];
  const temp = new Array(n);

  let width = 1;
  while (width < n) {
    let left = 0;
    while (left < n) {
      const mid = left + width;
      if (mid >= n) break;
      const right = Math.min(mid + width, n);

      let i = left;
      let j = mid;
      let k = left;

      while (i < mid && j < right) {
        const keyI = u[i].slice(keyStart0, keyStart0 + keyLen);
        const keyJ = u[j].slice(keyStart0, keyStart0 + keyLen);
        if (keyI <= keyJ) {
          temp[k] = u[i];
          i++;
        } else {
          temp[k] = u[j];
          j++;
        }
        k++;
      }
      while (i < mid) { temp[k] = u[i]; i++; k++; }
      while (j < right) { temp[k] = u[j]; j++; k++; }
      for (let m = left; m < right; m++) { u[m] = temp[m]; }
      left = left + 2 * width;
    }
    width = width * 2;
  }

  const validationPassed = u.length === expectedOut;

  return {
    inputCount: records.length,
    dupCount,
    uniqueCount: u.length,
    outputRecords: u,
    validationPassed,
    expectedOut
  };
}

function main() {
  console.log('=== Assignment 3 Local Validator (SIMULATED) ===\n');

  const fixtureC = readFixedRecords('fixture_c_120_records.txt', 100);
  console.log(`Input: ${fixtureC.length} records (100 bytes each)`);

  const result = simulateAssign3(fixtureC, 25, 8, 105);

  console.log('\nSimulated results:');
  console.log(`  Input records:    ${result.inputCount}`);
  console.log(`  Duplicates removed: ${result.dupCount}`);
  console.log(`  Unique records:    ${result.uniqueCount}`);
  console.log(`  Expected output:   ${result.expectedOut}`);
  console.log(`  Validation:        ${result.validationPassed ? 'PASSED' : 'FAILED'}`);

  writeFixedRecords('assign3_output_simulated.txt', result.outputRecords, 100);

  // Compare with expected output
  let match = true;
  try {
    const expected = readFixedRecords('expected_c_sorted_105.txt', 100);
    console.log(`\nExpected records: ${expected.length}`);

    if (result.outputRecords.length !== expected.length) {
      console.log(`FAIL: Count mismatch ${result.outputRecords.length} vs ${expected.length}`);
      match = false;
    } else {
      for (let i = 0; i < expected.length; i++) {
        if (result.outputRecords[i] !== expected[i]) {
          console.log(`FAIL: Record ${i} differs`);
          console.log(`  Got:      ${result.outputRecords[i]}`);
          console.log(`  Expected: ${expected[i]}`);
          match = false;
          break;
        }
      }
    }

    if (match) {
      console.log('Output matches expected: PASS');
    }
  } catch (e) {
    console.log('Expected file not found:', e.message);
    match = false;
  }

  // Fixture D: Key-dup vs Full-dup difference
  console.log('\n--- Fixture D: Key-dup vs Full-dup difference ---');
  const fixtureD = readFixedRecords('fixture_d_key_vs_full_dup.txt', 80);

  const seenFull = new Set();
  const uniqueFull = [];
  for (const rec of fixtureD) {
    if (!seenFull.has(rec)) {
      seenFull.add(rec);
      uniqueFull.push(rec);
    }
  }
  uniqueFull.sort((a, b) => a.localeCompare(b));

  const seenKey = new Set();
  const uniqueKey = [];
  for (const rec of fixtureD) {
    const key = rec.slice(12, 20);
    if (!seenKey.has(key)) {
      seenKey.add(key);
      uniqueKey.push(rec);
    }
  }
  uniqueKey.sort((a, b) => a.slice(12, 20).localeCompare(b.slice(12, 20)));

  console.log(`Fixture D (10 records, 80-byte):`);
  console.log(`  Full-record dedupe: ${uniqueFull.length} records`);
  console.log(`  Key-only dedupe:    ${uniqueKey.length} records`);

  const expectedDFull = readFixedRecords('expected_d_full_sorted.txt', 80);
  const expectedDKey = readFixedRecords('expected_d_key_sorted.txt', 80);

  let passD = true;
  if (uniqueFull.length !== expectedDFull.length) {
    console.log(`  Full-record: FAIL count ${uniqueFull.length} vs ${expectedDFull.length}`);
    passD = false;
  } else {
    for (let i = 0; i < uniqueFull.length; i++) {
      if (uniqueFull[i] !== expectedDFull[i]) {
        console.log(`  Full-record: FAIL record ${i} differs`);
        passD = false;
        break;
      }
    }
    if (passD) console.log(`  Full-record: PASS`);
  }

  if (uniqueKey.length !== expectedDKey.length) {
    console.log(`  Key-only: FAIL count ${uniqueKey.length} vs ${expectedDKey.length}`);
    passD = false;
  } else {
    for (let i = 0; i < uniqueKey.length; i++) {
      if (uniqueKey[i] !== expectedDKey[i]) {
        console.log(`  Key-only: FAIL record ${i} differs`);
        passD = false;
        break;
      }
    }
    if (passD) console.log(`  Key-only: PASS`);
  }

  console.log('\n=== Summary ===');
  if (result.validationPassed && match && passD) {
    console.log('All validations PASSED');
    process.exit(0);
  } else {
    console.log('Some validations FAILED');
    process.exit(1);
  }
}

main();