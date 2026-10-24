# What changed: COBOL now runs at the backend

Before: `POST /api/run` called a JavaScript re-implementation (`lib/pipeline.js`). The `.cbl` files were never executed.
Now: `POST /api/run` compiles (first run) and executes the COBOL programs as server processes and returns their job log.

## New files
| File | Purpose |
|---|---|
| `lib/cobol.js` | Compiles `mainframe/*.cbl` with `cobc`, converts datasets to fixed 80-byte records, runs each program with DD names (`DD_<name>` env vars), collects return codes and outputs |
| `mainframe/EXPDEDUP.cbl` | COBOL SORT + exact-duplicate removal (replaces the DFSORT step for local runs) |
| `mainframe/EXPTOTAL.cbl` | Category and monthly totals |
| `mainframe/EXPRPT.cbl` | Report sorted by amount descending; `BREAK_COUNT=Y` drops one record to demonstrate the RC 12 control |
| `cobol-test.js` | COBOL output must equal the Node reference on 393 generated records and edge cases |
| `scripts/build-cobol.js`, `scripts/run-cobol-batch.js` | `npm run build:cobol`, `npm run batch:cobol` |
| `Dockerfile` | Node + GnuCOBOL image (not built in the repository's checks) |

## Modified files
| File | Change |
|---|---|
| `routes/batch.js` | `/api/run` uses the COBOL engine by default (`{"engine":"js"}` selects the old simulator); new `GET /api/cobol/status` |
| `routes/index.js` | permission mapping (`batch:read`) for `/api/cobol/status` |
| `lib/workflow.js` | batch history records engine, steps and `GNUCOBOL_LOCAL` environment |
| `public/index.html` | Batch operations page: Load sample data, Run COBOL batch, Run with count mismatch, job log panel, dataset viewer, engine status banner |
| `mainframe/MATCH2.cbl` | internal file-names renamed (`TRANS-FILE`, ...) because GnuCOBOL rejects file-names equal to the DD name; DD names `FILE1`-`FILE4` unchanged, so `EXPPIPE.jcl` is unaffected |
| `mainframe/EXPVALID.cbl` | years before 1900 are rejected, matching the existing Node rule |
| `auth-test.js`, `package.json`, `.gitignore`, README, docs | tests, scripts, documentation |

`bin/` (compiled executables) is generated on the machine that runs the app and is not part of the zip: binaries compiled on Linux do not run on Windows.
