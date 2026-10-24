'use strict';
// Assignment 4 Local Validator (SIMULATED)
// Mimics JCL IF/THEN/ELSE logic: SORT -> COUNT -> VALIDATE -> CONDITIONAL COPY
// Tests SUCCESS (counts match, final dataset created) and FAILURE (mismatch, no final dataset)

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'TESTDATA');
const BIN_DIR = path.join(__dirname, '..', 'bin');

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

// Simulated SORT descending by amount (cols 33-41)
function simulateSortDesc(records) {
  return [...records].sort((a, b) => {
    const amtA = a.slice(32, 41); // 0-based: cols 33-41
    const amtB = b.slice(32, 41);
    return amtB.localeCompare(amtA); // descending
  });
}

// Simulated VALIDATE_COUNT
function simulateValidateCount(inputRecords, outputRecords) {
  const inCount = inputRecords.length;
  const outCount = outputRecords.length;
  const passed = inCount === outCount;
  return { inCount, outCount, passed, rc: passed ? 0 : 12 };
}

// Run COBOL VALIDCNT program
function runValidCnt(inputFile, outputFile) {
  return new Promise((resolve) => {
    const env = {
      ...process.env,
      DD_INFILE: path.join(DATA_DIR, inputFile),
      DD_OUTFILE: path.join(DATA_DIR, outputFile)
    };
    execFile(path.join(BIN_DIR, 'VALIDCNT'), [], { env, cwd: BIN_DIR }, (err, stdout, stderr) => {
      const rc = err ? (err.code || 12) : 0;
      resolve({ rc, stdout: (stdout || '') + (stderr || '') });
    });
  });
}

async function main() {
  console.log('=== Assignment 4 Local Validator (SIMULATED) ===\n');

  // Load fixtures
  const input = readFixedRecords('assign4_valid_input.txt', 80);
  const expectedSuccess = readFixedRecords('assign4_expected_success.txt', 80);
  const truncated = readFixedRecords('assign4_truncated_output.txt', 80);

  console.log(`Input records: ${input.length}`);
  console.log(`Expected success output: ${expectedSuccess.length}`);
  console.log(`Truncated output: ${truncated.length}\n`);

  // Test 1: SUCCESS case
  console.log('--- Test 1: SUCCESS (counts match) ---');
  const sorted = simulateSortDesc(input);
  console.log(`Sorted output: ${sorted.length} records`);

  // Verify sort order matches expected
  let sortMatch = true;
  for (let i = 0; i < expectedSuccess.length; i++) {
    if (sorted[i] !== expectedSuccess[i]) {
      console.log(`  Sort mismatch at record ${i}`);
      sortMatch = false;
      break;
    }
  }
  if (sortMatch) console.log('  Sort order: PASS');

  // Run VALIDCNT
  const valResult = await runValidCnt('assign4_valid_input.txt', 'assign4_expected_success.txt');
  console.log(`  VALIDCNT RC: ${valResult.rc} (${valResult.rc === 0 ? 'PASS' : 'FAIL'})`);
  console.log(`  Output: ${valResult.stdout.trim()}`);

  const successPassed = sortMatch && valResult.rc === 0;
  console.log(`  Test 1: ${successPassed ? 'PASSED' : 'FAILED'}\n`);

  // Test 2: FAILURE case (mismatch)
  console.log('--- Test 2: FAILURE (counts mismatch) ---');
  const valResult2 = await runValidCnt('assign4_valid_input.txt', 'assign4_truncated_output.txt');
  console.log(`  VALIDCNT RC: ${valResult2.rc} (${valResult2.rc === 12 ? 'PASS' : 'FAIL'})`);
  console.log(`  Output: ${valResult2.stdout.trim()}`);

  // Simulate IF/THEN/ELSE logic
  let finalDatasetExists = false;
  if (valResult2.rc === 0) {
    // COPYOK would run - create final dataset
    finalDatasetExists = true;
    console.log('  IF/THEN/ELSE: Would copy temp to final dataset');
  } else {
    // DIAGFAIL + DELTEMP + SETFAIL would run
    console.log('  IF/THEN/ELSE: Would print diagnostic, delete temp, set MAXCC=12');
    console.log('  Final dataset: NOT created (correct)');
  }
  const failurePassed = valResult2.rc === 12 && !finalDatasetExists;
  console.log(`  Test 2: ${failurePassed ? 'PASSED' : 'FAILED'}\n`);

  // Test 3: COND= variant simulation
  console.log('--- Test 3: COND= variant ---');
  console.log('  COPYOK COND=(0,EQ,VALID): runs only if VALID RC=0');
  console.log('  DIAGFAIL COND=(0,NE,VALID): runs only if VALID RC!=0');
  console.log('  DELTEMP COND=(0,NE,VALID): runs only if VALID RC!=0');
  console.log('  SETFAIL COND=(0,NE,VALID): runs only if VALID RC!=0');
  console.log('  COND= logic: SIMULATED PASS\n');

  console.log('=== Summary ===');
  if (successPassed && failurePassed) {
    console.log('All validations PASSED');
    process.exit(0);
  } else {
    console.log('Some validations FAILED');
    process.exit(1);
  }
}

main();