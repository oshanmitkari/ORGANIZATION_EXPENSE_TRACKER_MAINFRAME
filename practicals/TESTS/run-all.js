'use strict';
// Test runner for all practicals validators
// Runs: validate-assign1.js, validate-assign2.js, validate-assign3.js, validate-assign4.js
// Prints PASS / FAIL / SKIPPED for each

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const TESTS_DIR = path.join(__dirname);
const ROOT_DIR = path.join(__dirname, '..', '..');

const testScripts = [
  { name: 'Assignment 1 (JCL SORT dedupe)', script: 'validate-assign1.js' },
  { name: 'Assignment 2 (COBOL match)', script: 'validate-assign2.js' },
  { name: 'Assignment 3 (REXX dedupe/sort)', script: 'validate-assign3.js' },
  { name: 'Assignment 4 (Sort validate)', script: 'validate-assign4.js' },
];

function runTest(test) {
  return new Promise((resolve) => {
    const scriptPath = path.join(TESTS_DIR, test.script);
    if (!fs.existsSync(scriptPath)) {
      resolve({ name: test.name, status: 'SKIPPED', reason: 'Script not found' });
      return;
    }
    execFile('node', [scriptPath], { cwd: TESTS_DIR, timeout: 30000 }, (err, stdout, stderr) => {
      const output = (stdout || '') + (stderr || '');
      if (err) {
        if (err.code === 'ENOENT') {
          resolve({ name: test.name, status: 'SKIPPED', reason: 'Node not found' });
        } else {
          resolve({ name: test.name, status: 'FAIL', output: output.trim() });
        }
      } else {
        resolve({ name: test.name, status: 'PASS', output: output.trim() });
      }
    });
  });
}

async function main() {
  console.log('=== Practicals Test Suite ===\n');
  
  const results = [];
  for (const test of testScripts) {
    process.stdout.write(`Running ${test.name}... `);
    const result = await runTest(test);
    results.push(result);
    console.log(result.status);
    if (result.status !== 'PASS') {
      console.log(`  ${result.reason || result.output}`);
    }
  }

  console.log('\n=== Summary ===');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  
  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'FAIL' ? '✗' : '⊘';
    console.log(`  ${icon} ${r.name}: ${r.status}`);
  });
  
  console.log(`\nTotal: ${results.length}, Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main();