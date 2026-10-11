'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { USERS_FILE, hash } = require('../lib/auth');

async function main() {
  if (process.env.ALLOW_DEMO_BOOTSTRAP !== 'YES') throw new Error('Set ALLOW_DEMO_BOOTSTRAP=YES to explicitly create local demo accounts.');
  if (fs.existsSync(USERS_FILE)) throw new Error(`Refusing to overwrite ${USERS_FILE}; remove it deliberately to re-bootstrap.`);
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
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
  console.log(`Created ${USERS_FILE}. Store the displayed passwords securely; they cannot be retrieved from the password hashes.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
