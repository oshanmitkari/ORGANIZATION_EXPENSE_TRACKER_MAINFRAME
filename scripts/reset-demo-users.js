'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { USERS_FILE, hash } = require('../lib/auth');

async function main() {
  if (process.env.ALLOW_DEMO_RESET !== 'YES') {
    throw new Error('Set ALLOW_DEMO_RESET=YES to explicitly reset local demo accounts.');
  }
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  if (fs.existsSync(USERS_FILE)) {
    const backup = `${USERS_FILE}.backup.${Date.now()}`;
    fs.renameSync(USERS_FILE, backup);
    console.log(`Backed up existing accounts to ${backup}`);
  }
  const specs = [
    ['employee.demo','EMPLOYEE','E0001002','Apex Demo Employee'],
    ['manager.demo','MANAGER','E0001001','Apex Demo Manager'],
    ['finance.demo','FINANCE_OPERATOR','E0001003','Apex Demo Finance Operator'],
    ['admin.demo','FINANCE_ADMIN','E0001004','Apex Demo Finance Administrator'],
    ['auditor.demo','AUDITOR','E0001005','Apex Demo Auditor']
  ];
  const users = [];
  for (const [username, role, employeeId, name] of specs) {
    const password = crypto.randomBytes(18).toString('base64url');
    const salt = crypto.randomBytes(16).toString('hex');
    users.push({ username, role, employeeId, name, salt, passwordHash: await hash(password, salt) });
    console.log(`${username} (${role}) one-time password: ${password}`);
  }
  const temp = USERS_FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(users, null, 2), { flag: 'wx', mode: 0o600 });
  fs.renameSync(temp, USERS_FILE);
  console.log(`Created fresh local demo accounts in ${USERS_FILE}.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
