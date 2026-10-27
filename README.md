# Apex Corporate Services — Expense Management

A dependency-free Node.js local demonstration of expense intake, employee-reference checks, approval workflow, role-based access, audit events, and an 80-byte fixed-width batch simulator. The mainframe directory contains separate z/OS source and deployment examples; it is not executed by the web app.

## Local setup

Requirements: Node.js 18 or later. No package installation is required.

Create local demo users once. This writes password hashes to ignored `data/users.json` and prints random one-time passwords. Store those passwords securely.

```powershell
$env:ALLOW_DEMO_BOOTSTRAP='YES'
npm run demo:bootstrap
Remove-Item Env:ALLOW_DEMO_BOOTSTRAP
npm start
```

Open http://localhost:3000. If that port is occupied, run `$env:PORT='3137'; npm start` and open http://localhost:3137. The local login is a demonstration mechanism; it is not enterprise SSO. Sessions are in memory and end at logout, expiry, or server restart. Use HTTPS and a production session store before any real deployment.

The initial sample employees in `data/EMPLOYEE.MASTER` are E0001001–E0001006. The generated identities are `employee.demo`, `manager.demo`, `finance.demo`, `admin.demo`, and `auditor.demo`, with roles EMPLOYEE, MANAGER, FINANCE_OPERATOR, FINANCE_ADMIN, and AUDITOR respectively. Their employee IDs are E0001002, E0001001, E0001003, E0001004, and E0001005. The bootstrap prints each password once; there are no default passwords or public registration.

## Role security

The server resolves identity only from an HttpOnly, SameSite=Strict session cookie. It ignores browser-supplied role/employee headers. Permissions are centralized in `lib/auth.js`; API routes deny unauthenticated and unauthorized requests, then apply expense/manager scope checks in `lib/workflow.js`. Role changes are not exposed through an API. Authentication failures, access denials, employee changes, and workflow changes are recorded without passwords.

This is local demo RBAC, not production identity: accounts are bootstrapped from the local machine, sessions are process-memory records, rate limits are process-local, and local JSON persistence is not a concurrent database. `data/users.json` and `data/workflow-demo.json` are excluded by `.gitignore`.

See [RBAC and API permissions](docs/RBAC.md) for the permission matrix, route inventory, role test instructions, and state rules.

## Implemented workflows

- Draft creation/editing, duplicate warning, submission, assigned-manager approve/reject, mandatory rejection reason, and separate idempotent finance posting.
- Role-scoped overview metrics, recent claims, expense list, approvals, employee reference maintenance for Finance Administrators, reports, batch history, and read-only audit view.
- Fixed-width pipeline simulation with exact duplicate removal, employee matching, date/category/amount validation, exception files, summaries, and a deliberate report count-mismatch path.
- Upload rejects records that are not exactly 80 printable single-byte characters; it does not pad or truncate input.

## Local storage and integration boundary

`data/workflow-demo.json` is local workflow storage. `data/EXPENSE.*` are local batch inputs and outputs. They are not synchronized with one another. Batch validation does not post claims in the workflow ledger or connect to a financial ledger. The app does not connect to DB2, VSAM, RACF, or z/OS and does not submit JCL.

The mainframe flow is intended to be connected through a separately implemented secure integration service and controlled datasets. See [mainframe verification matrix](docs/REQUIREMENT-VERIFICATION.md) and [z/OS operations guide](docs/MAINFRAME-SETUP.md).
## Mainframe artifacts

- `mainframe/MATCH2.cbl`, `EXPVALID.cbl`, and `CNTCHECK.cbl`: sequential employee matching, field validation, and count verification programs.
- `mainframe/VSAMLOOK.cbl`, `VSAM-DEFINE.jcl`, and `VSAM-MATCH.jcl`: 80-byte employee KSDS layout, lookup source, and run templates.
- `mainframe/EXPCLEAN.jcl`, `EXPPIPE.jcl`, `RPTCHECK.jcl`, and `EXPENSUM.jcl`: DFSORT and ICETOOL dedupe, staged processing, sorted reports, totals, and count checks.
- `mainframe/DEDUPSRT.rexx`: TSO/E exact dedupe and employee-key sort example.
- `mainframe/rexx/EXPMON.rexx` and `mainframe/jcl/EXPMON.jcl`: bounded post-processing automation that checks EXPPOST result records and returns RC 0, 4, or 12.
- `mainframe/db2/`: relational DDL, query examples, and the embedded-SQL `POSTEXP.sqc` plus DSN JCL posting example.
- `mainframe/ops/RACF-ACCESS-EXAMPLE.txt`: site-customized least-privilege example; admin authority required.

The COBOL/JCL expense path has been compiled and runtime-verified in the dedicated `Z86073.EXPTRK.*` namespace on z/OS. The separate Db2 artifacts remain uncompiled/unsubmitted. See the verification matrix and [z/OS operations guide](docs/MAINFRAME-SETUP.md) for evidence and remaining target checks.

## 80-byte transaction record

| Bytes | Width | Field | Representation |
|---|---:|---|---|
| 1-12 | 12 | Transaction identifier | Character |
| 13-20 | 8 | Employee identifier | Character |
| 21-28 | 8 | Transaction date | `YYYYMMDD` |
| 29-32 | 4 | Category code | Character |
| 33-41 | 9 | Amount | Zero-padded integer cents |
| 42–80 | 39 | Description | Printable single-byte characters, space padded |

Maximum amount is INR 9,999,999.99. Legacy batch category codes are FOOD, TRVL, OFFC, MEDC, UTIL, and TRNG. The workflow category list uses business labels and is not yet mapped/exported to the legacy record codes.

## FastAPI / real z/OS integration

The repository includes a separate FastAPI service in `backend/`. It is the controlled bridge for the project-owned expense KSDS and uses Zowe CLI subprocess calls, asynchronous request/job state, exact paise serialization, and COBOL result records. It does not replace the existing Node demo or silently fall back to local data. Start it with the commands in [backend/README.md](backend/README.md). With `ZOWE_ENABLED=false` (the safe default), requests are retained and honestly marked unavailable; `posted` is only returned after a matching mainframe result record.

The existing Node-served browser UI can be switched explicitly to the live FastAPI path with `UI_MODE=mainframe`. In that mode its listing and report screens read the verified `Z86073.EXPTRK.REPORT` workflow through FastAPI, and its creation form submits only to the controlled `/api/expenses` contract. The default `UI_MODE=demo` remains the local demonstration workflow.

For normal username/password testing, run `npm run start:demo` (or `npm start`) without `UI_MODE=mainframe`. Create the local demo accounts once with `ALLOW_DEMO_BOOTSTRAP=YES npm run demo:bootstrap`; the command prints separate one-time credentials for Employee, Manager, Finance Operator, Finance Administrator, and Auditor roles.

If the one-time passwords were lost, reset the local demo accounts explicitly with `ALLOW_DEMO_RESET=YES npm run demo:reset`. The existing `data/users.json` is renamed to a timestamped backup before fresh credentials are generated and printed.

The new mainframe assets are `mainframe/copybooks/EXPCOPY.cpy`, `mainframe/cobol/EXPPOST.cbl`, `EXPREAD.cbl`, `EXPRPT.cbl`, `mainframe/jcl/EXPDEF.jcl`, `EXPLOAD.jcl`, `EXPPOST.jcl`, `EXPREAD.jcl`, `EXPRPT.jcl`, `EXPMON.jcl`, and `mainframe/rexx/EXPMON.rexx`. They use the separate `&SYSUID..EXPTRK.*` namespace and do not redefine the existing coursework clusters.

## Tests

```powershell
npm test
```

The FastAPI unit tests run independently with `pytest -q backend/tests` after installing `backend/requirements.txt`.

This runs pipeline regression tests and direct HTTP tests using a temporary data directory and test-only hashed accounts. It covers unauthenticated access, all demo roles, forged identity headers, cross-user access, manager assignment, self-approval, posting, batch execution, auditor read-only access, mass-assignment rejection, logout, count mismatch, and audited denials. It does not compile COBOL or validate JCL/REXX/Db2/VSAM/RACF on z/OS.

## Current limits

- Receipt attachment, full employee deactivation/edit, configurable category maintenance, role-administration UI, date filters, large-table pagination, reversals, and financial-system reconciliation are not implemented.
- Workflow JSON and batch datasets are separate local stores. Atomic file replacement reduces partial writes in one process, but this is not multi-process transaction control.
- Mainframe examples need site customization, compilation, execution, and JES/Db2 evidence before they can be called target-tested. Their individual status is documented in the verification matrix.

## Packaging

ZIP the `expense-tracker` directory. Exclude `node_modules`, `data/users.json`, any real or non-disposable `data/workflow-demo.json`, credentials, and logs. No npm dependencies are required.
