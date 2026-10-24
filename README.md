# Apex Corporate Services — Expense Management

A Node.js web application for expense intake, employee-reference checks, approval workflow, role-based access and audit events. **The batch processing is executed by real COBOL programs on the server**: when a Finance user clicks *Run COBOL batch* in the browser, the Node backend compiles (first time only) and runs the COBOL programs in `mainframe/` with GnuCOBOL, passes them 80-byte fixed-width datasets through DD-name environment variables, and shows the job log, return codes and output datasets in the UI. The app has no npm dependencies; the only external requirement is the GnuCOBOL compiler.

## How the browser triggers COBOL

```
Browser (Batch operations page)
   |  POST /api/run  {engine:"cobol", breakCount:false}         (needs batch:execute permission)
   v
Node server  routes/batch.js  ->  lib/cobol.js
   |  1. ingest check: every record must be 80 printable single-byte characters
   |  2. write fixed-length 80-byte datasets to a private temp directory
   |  3. spawn the compiled COBOL programs one after another (DD names = DD_<name> environment variables)
   v
EXPDEDUP -> MATCH2 -> EXPVALID -> EXPTOTAL -> EXPRPT -> CNTCHECK        (mainframe/*.cbl)
   |  4. read the output datasets and return codes
   v
data/EXPENSE.*  +  JSON response (job log, RCs, counts)  ->  shown in the browser
```

| Program | Job step | Reads (DD) | Writes (DD) | Return codes |
|---|---|---|---|---|
| `EXPDEDUP` | sort by employee id, drop exact duplicates | `TRANSIN` | `CLEANOUT`, `DUPSOUT` | 0 / 12 |
| `MATCH2` | match employee ids against the employee master | `FILE1` (transactions), `FILE2` (master) | `FILE3` (matched), `FILE4` (unknown, 110 bytes) | 0 / 4 unknown found / 12 |
| `EXPVALID` | validate amount, calendar date, category | `TRANSIN` | `GOODOUT`, `REJOUT` (110 bytes) | 0 / 4 rejects / 12 |
| `EXPTOTAL` | category and monthly totals | `INFILE` | `CATOUT`, `MONOUT` | 0 / 12 |
| `EXPRPT` | report sorted by amount, descending (`BREAK_COUNT=Y` drops the last record on purpose) | `INFILE` | `OUTFILE` | 0 / 12 |
| `CNTCHECK` | input count must equal report count | `INFILE`, `OUTFILE` | - | 0 pass / 12 fail |

If `CNTCHECK` returns 12 the Node server deletes `EXPENSE.REPORT`, exactly like the original design. The old JavaScript implementation in `lib/pipeline.js` is kept only as a reference for the tests (and can be selected with `{"engine":"js"}`); `cobol-test.js` proves that the COBOL output is identical to it.

## Install GnuCOBOL (one time)

Check first: `cobc --version`. If that prints a version, skip this section.

- **Windows (recommended: WSL)**: open PowerShell, run `wsl --install -d Ubuntu`, restart, then inside Ubuntu: `sudo apt update && sudo apt install -y gnucobol nodejs npm`. Run the project from inside Ubuntu (copy it into your Linux home folder, for example `~/expense-tracker`).
- **Windows (native)**: install a GnuCOBOL 3.x Windows build (for example the "GnuCOBOL 3.2 for Windows" binaries from the GnuCOBOL project or Arnold Trembley's builds), then start PowerShell through the *GnuCOBOL command prompt* shortcut (or add its `bin` folder to `PATH` and set the `COB_*` variables its `set_env` script defines). If `cobc` is not on `PATH`, set `COBC_PATH`, e.g. `$env:COBC_PATH='C:\GnuCOBOL\bin\cobc.exe'`.
- **Ubuntu / Debian**: `sudo apt update && sudo apt install -y gnucobol`
- **macOS**: `brew install gnucobol`
- **Docker (no local install)**: see the `Dockerfile` section below.

## Run it

```bash
npm run build:cobol        # optional: compiles mainframe/*.cbl into ./bin (done automatically on first run otherwise)
npm run batch:cobol        # optional: run the COBOL batch from the terminal and print the job log
npm start                  # start the web app on http://localhost:3000
```

In the browser: sign in with a Finance account (for example `finance.demo`), open **Batch operations**, click **Load sample data** (adds sample transactions, including duplicates, an unknown employee, a bad date and a bad category), then **Run COBOL batch**. The page shows the job log (one block per COBOL step with its return code and DISPLAY output), the output datasets (`EXPENSE.CLEAN`, `EXPENSE.VALID`, `EXPENSE.REJECT`, `EXPENSE.REPORT`, ...) and the run history. **Run with count mismatch** makes `CNTCHECK` fail with RC 12 and removes the report.

Docker alternative: `docker build -t expense-cobol .` then `docker run -p 3000:3000 expense-cobol`. This image has GnuCOBOL and Node installed, but it has not been built or run in this repository's checks.

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
- COBOL batch pipeline run on the server from the browser: exact duplicate removal, employee matching, date/category/amount validation, exception files, category and monthly totals, amount-sorted report, and a deliberate report count-mismatch path (RC 12).
- Upload rejects records that are not exactly 80 printable single-byte characters; it does not pad or truncate input.

## Local storage and integration boundary

`data/workflow-demo.json` is local workflow storage. `data/EXPENSE.*` are local batch inputs and outputs. They are not synchronized with one another. Batch validation does not post claims in the workflow ledger or connect to a financial ledger. The COBOL programs run locally under GnuCOBOL; the app does not connect to DB2, VSAM, RACF, or z/OS and does not submit JCL.

The mainframe flow is intended to be connected through a separately implemented secure integration service and controlled datasets. See [mainframe verification matrix](docs/REQUIREMENT-VERIFICATION.md) and [z/OS operations guide](docs/MAINFRAME-SETUP.md).
## Mainframe artifacts

- `mainframe/EXPDEDUP.cbl`, `MATCH2.cbl`, `EXPVALID.cbl`, `EXPTOTAL.cbl`, `EXPRPT.cbl`, and `CNTCHECK.cbl`: dedupe/sort, employee matching, field validation, totals, report, and count verification programs (executed by the web app).
- `mainframe/VSAMLOOK.cbl`, `VSAM-DEFINE.jcl`, and `VSAM-MATCH.jcl`: 80-byte employee KSDS layout, lookup source, and run templates.
- `mainframe/EXPCLEAN.jcl`, `EXPPIPE.jcl`, `RPTCHECK.jcl`, and `EXPENSUM.jcl`: DFSORT and ICETOOL dedupe, staged processing, sorted reports, totals, and count checks.
- `mainframe/DEDUPSRT.rexx`: TSO/E exact dedupe and employee-key sort example.
- `mainframe/db2/`: relational DDL, query examples, and the embedded-SQL `POSTEXP.sqc` plus DSN JCL posting example.
- `mainframe/ops/RACF-ACCESS-EXAMPLE.txt`: site-customized least-privilege example; admin authority required.

`MATCH2`, `EXPVALID`, `CNTCHECK`, `EXPDEDUP`, `EXPTOTAL` and `EXPRPT` are compiled and executed by the web app with GnuCOBOL (verified by `cobol-test.js` against the Node reference implementation). They have **not** been compiled with IBM Enterprise COBOL or run on z/OS. The JCL, REXX, VSAM, Db2 and RACF artifacts have not been submitted or run on z/OS/Db2. See the verification matrix for concrete gaps and required target checks.

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

## Tests

```powershell
npm test
```

This runs pipeline regression tests, `cobol-test.js` (compiles the COBOL programs and requires their output to equal the Node reference on 393 generated records plus edge cases; it prints SKIPPED if GnuCOBOL is missing), and direct HTTP tests using a temporary data directory and test-only hashed accounts. It covers unauthenticated access, all demo roles, forged identity headers, cross-user access, manager assignment, self-approval, posting, batch execution, auditor read-only access, mass-assignment rejection, logout, count mismatch, and audited denials. It does not validate JCL/REXX/Db2/VSAM/RACF or IBM Enterprise COBOL on z/OS.

## Current limits

- Receipt attachment, full employee deactivation/edit, configurable category maintenance, role-administration UI, date filters, large-table pagination, reversals, and financial-system reconciliation are not implemented.
- Workflow JSON and batch datasets are separate local stores. Atomic file replacement reduces partial writes in one process, but this is not multi-process transaction control.
- Mainframe examples need site customization, compilation, execution, and JES/Db2 evidence before they can be called target-tested. Their individual status is documented in the verification matrix.

## Packaging

ZIP the `expense-tracker` directory. Exclude `node_modules`, `data/users.json`, any real or non-disposable `data/workflow-demo.json`, credentials, and logs. No npm dependencies are required.
