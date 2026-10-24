'use strict';
// Assignment 2 Local Validator (SIMULATED)
// Implements in-memory table lookup match logic in Node.js
// Compares output against expected counts

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

// Simulated match logic (in-memory table lookup)
function simulateMatch(trans, master) {
  // Build master key set
  const masterKeys = new Set();
  let masterDup = 0;
  for (const rec of master) {
    const key = rec.slice(20, 28); // cols 21-28 (0-based 20-27)
    if (masterKeys.has(key)) masterDup++;
    masterKeys.add(key);
  }

  // Build trans key set for duplicate counting
  const transKeys = new Set();
  let transDup = 0;

  const matched = [];
  const unmatched = [];

  for (const rec of trans) {
    const key = rec.slice(12, 20); // cols 13-20 (0-based 12-19)
    if (transKeys.has(key)) transDup++;
    transKeys.add(key);

    if (masterKeys.has(key)) {
      matched.push(rec);
    } else {
      const reason = masterKeys.size === 0 ? 'EMPTY EMPLOYEE MASTER' : 'EMPLOYEE NOT IN MASTER';
      unmatched.push(rec + reason.padEnd(30, ' '));
    }
  }

  return {
    masterRead: master.length,
    masterDup,
    transRead: trans.length,
    transDup,
    matched: matched.length,
    unmatched: unmatched.length,
    matchedRecords: matched,
    unmatchedRecords: unmatched
  };
}

function main() {
  console.log('=== Assignment 2 Local Validator (SIMULATED) ===\n');

  // Load input fixtures
  const trans = readFixedRecords('assign2_trans50.txt', 80);
  const master = readFixedRecords('assign2_master50.txt', 80);

  console.log(`Input: ${trans.length} transactions, ${master.length} master records`);

  // Run simulation
  const result = simulateMatch(trans, master);

  console.log('\nSimulated results:');
  console.log(`  Master read: ${result.masterRead}`);
  console.log(`  Master dup keys: ${result.masterDup}`);
  console.log(`  Trans read: ${result.transRead}`);
  console.log(`  Trans dup keys: ${result.transDup}`);
  console.log(`  Matched: ${result.matched}`);
  console.log(`  Unmatched: ${result.unmatched}`);

  // Expected: 35 matched, 15 unmatched
  const expectedMatched = 35;
  const expectedUnmatched = 15;

  let pass = true;
  if (result.matched !== expectedMatched) {
    console.log(`\nFAIL: Matched count ${result.matched} != ${expectedMatched}`);
    pass = false;
  }
  if (result.unmatched !== expectedUnmatched) {
    console.log(`\nFAIL: Unmatched count ${result.unmatched} != ${expectedUnmatched}`);
    pass = false;
  }

  // Write output files for comparison with COBOL
  writeFixedRecords('assign2_matched_expected.txt', result.matchedRecords, 80);
  writeFixedRecords('assign2_unmatched_expected.txt', result.unmatchedRecords, 110);

  // Compare with COBOL output if exists
  try {
    const cobolMatched = readFixedRecords('assign2_matched_out.txt', 80);
    const cobolUnmatched = readFixedRecords('assign2_unmatched_out.txt', 110);

    console.log('\nCOBOL output:');
    console.log(`  Matched: ${cobolMatched.length}`);
    console.log(`  Unmatched: ${cobolUnmatched.length}`);

    if (cobolMatched.length === result.matched && cobolUnmatched.length === result.unmatched) {
      // Compare records
      let match = true;
      for (let i = 0; i < result.matched; i++) {
        if (cobolMatched[i] !== result.matchedRecords[i]) {
          console.log(`  Matched record ${i} differs`);
          match = false;
          break;
        }
      }
      for (let i = 0; i < result.unmatched; i++) {
        if (cobolUnmatched[i] !== result.unmatchedRecords[i]) {
          console.log(`  Unmatched record ${i} differs`);
          match = false;
          break;
        }
      }
      if (match) {
        console.log('  COBOL output matches simulation: PASS');
      } else {
        console.log('  COBOL output differs from simulation: FAIL');
        pass = false;
      }
    } else {
      console.log('  COBOL output counts differ from simulation: FAIL');
      pass = false;
    }
  } catch (e) {
    console.log('\nCOBOL output files not found, skipping comparison');
  }

  console.log('\n=== Summary ===');
  if (pass) {
    console.log('All validations PASSED');
    process.exit(0);
  } else {
    console.log('Some validations FAILED');
    process.exit(1);
  }
}

main();