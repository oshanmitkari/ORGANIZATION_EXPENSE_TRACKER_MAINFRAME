# FastAPI mainframe integration

This is the production-oriented integration layer for the existing Node-served UI. The UI remains intact; this service provides the explicit FastAPI/Zowe path described in the project brief. It does not emulate z/OS and it never reports `posted` without a matching result record produced by the COBOL job.

## Data contract

Every transaction is an FB80 host-text record. The project-owned VSAM KSDS is `Z86073.EXPTRK.MASTER` and its primary key is bytes 1-12 (`EXPENSE_ID`, zero-based offset 0, length 12). The full layout is documented in `mainframe/copybooks/EXPCOPY.cpy`:

| bytes | field | rule |
|---|---|---|
| 1-12 | expense ID | uppercase, padded with spaces |
| 13-20 | employee ID | uppercase, padded with spaces |
| 21-28 | date | `YYYYMMDD` |
| 29-32 | category | four-character allowlisted code |
| 33-41 | amount | integer paise, nine digits, zero padded |
| 42-80 | description | 39 single-byte-safe characters, space padded |

`EXPCOPY.cpy`, `layout.py`, `EXPPOST.cbl`, all JCL DCBs, and result parsing use this contract. Result records are pipe-delimited `expense_id|POSTED|reason|reference` records in the configured result dataset.

## Local run

```bash
python3.11 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
pytest -q backend/tests
```

By default `ZOWE_ENABLED=false`; submissions are retained in `backend/runtime/jobs.json` and marked `unavailable`. This is intentional. To enable the real path, authenticate Zowe using the site's approved profile mechanism and set `ZOWE_ENABLED=true`, `MAINFRAME_HLQ`, `EXPENSE_CLUSTER`, `TRANSACTION_DATASET`, `RESULT_DATASET`, `EMPLOYEE_DATASET`, and `POST_JCL`. No credential belongs in this repository. The configured frontend origin defaults to `http://localhost:3000`.

The adapter uses argument-list subprocess calls, timeouts, dataset/job allowlists, variable-format local JCL submission, and JSON output where supported. It retrieves JES output with `zos-jobs view all-spool-content` (the installed CLI does not support the older `job-file-by-jobid` spelling). It does not accept JCL, dataset names, or shell fragments from HTTP clients. Verify installed syntax with `zowe <group> <command> --help` on the target installation before deployment.

### Transaction allocation and contention

Live submissions default to `TRANSACTION_DATASET_MODE=per-request`. Each request gets a unique `Z86073.EXPTRK.TXN.*` FB/80 dataset. The API submits a small `IEFBR14` allocation job using `UNIT=SYSDA`, waits for `CC 0000`, uploads the transaction record to that dataset, and submits generated `EXPPOST` JCL with `TRANSIN` pointing to it. This avoids concurrent writes to the shared `Z86073.EXPTRK.TRAN` dataset. The allocation JCL route is used because z/OSMF dynamic allocation returned an SMS/ACS error in this account. Set `TRANSACTION_DATASET_MODE=shared` only for a site-approved single-writer setup.

## Browser integration

The existing browser application is a Node-served HTML/JavaScript application, not React. Its default `UI_MODE=demo` keeps the local authentication and workflow unchanged. For the live path, start FastAPI and the same UI with an explicit mainframe mode:

```bash
ZOWE_CLI_HOME=/home/krishna-lokhande/.zowe ZOWE_ENABLED=true \
  FRONTEND_ORIGIN=http://localhost:3000 \
  uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

UI_MODE=mainframe FASTAPI_BASE_URL=http://localhost:8000 PORT=3000 node server.js
```

In live mode the Node server exposes only an allowlisted same-origin proxy for the FastAPI paths; Zowe credentials never reach the browser. The UI uses `GET /api/health`, `GET /api/mainframe/health`, `GET /api/expenses`, `GET /api/reports/mainframe`, `GET /api/reports/monthly`, `GET /api/reports/categories`, `POST /api/expenses`, and `GET /api/jobs/{request_id}`. Expense creation is asynchronous: the UI displays queued/running/posted/rejected/failed/unavailable states and only refreshes to `Posted` after the matching mainframe result is confirmed.

If port 3000 is occupied, use the same port for the frontend origin and UI, for example `FRONTEND_ORIGIN=http://localhost:3001` with `PORT=3001`.

## Mainframe deployment

1. Have the administrator review and run `mainframe/jcl/EXPDEF.jcl` once in a disposable HLQ. It defines a new cluster only; it never touches `Z86073.VSAM.KSDS` or `Z86073.VSAMDS`.
2. Compile and link `mainframe/cobol/EXPPOST.cbl`, `EXPREAD.cbl`, and `EXPRPT.cbl` with the site's approved Enterprise COBOL procedure and copybook concatenation. Put load modules in `&SYSUID..EXPTRK.LOAD`.
3. Provision the project-owned employee KSDS at `Z86073.EXPTRK.EMPLOYEE` (or the configured HLQ equivalent) with FB80 records and key bytes 1-8. The documented record is `ID(8)|NAME(30)|DEPT(10)|STATUS(1)|FILLER(31)`; the seed IDs are `E0001001`, `E0001002`, `E0001003`, and inactive `E0001004`. Allocate transaction/result PS datasets with `RECFM=FB,LRECL=80` and `RECFM=FB,LRECL=120`. Retain the input until application-level counts and result records are captured.
4. Use `EXPLOAD.jcl` only for synthetic seed records after cluster definition. Use `EXPPOST.jcl`, `EXPREAD.jcl`, and `EXPRPT.jcl` for their named operations.
5. Run `EXPMON.jcl` after `EXPPOST.jcl` when an operational result check is required. The JCL invokes `EXPMON.rexx` from `&SYSUID..REXX` against `Z86073.EXPTRK.RESULT`. RC 0 means all records are posted, RC 4 means valid processing with rejections, and RC 12 means malformed, unknown-status, missing output, or an operational error. The REXX member is bounded to a dataset argument and does not submit arbitrary commands.

Provisioning is never automatic at API startup. Existing coursework members and clusters are read-only references. The verified project runtime used explicit Zowe downloads with IBM-1047 conversion, bounded polling, and result-record confirmation; the API reports `unavailable` or `failed`, never fake success, when those prerequisites are absent.

## Verified z/OS results

On 2026-10-24, the configured Zowe connection reported user `Z86073`, z/OS 5.29, and z/OSMF 29.0. The installed CLI reported Zowe CLI 8.39.1 / Zowe release 3.6.0. Read-only dataset/member inspection confirmed the existing libraries and the absence of the project member names before upload.

The existing reference JCL uses `IGYWCL`, expanded from `VENDOR.PROCLIB`, with IBM Enterprise COBOL 6.5.0. A reference compile completed as `JOB02980` with COBOL RC 00, LKED RC 00, and job RC 0000. The project programs were then compiled without a RUN step or VSAM DD: `EXPPOST` as `JOB02996`, `EXPREAD` as `JOB02999`, and `EXPRPT` as `JOB03002`; all completed with `CC 0000`. Project members were added only to previously absent members in `Z86073.CBL`, `Z86073.SOURCE`, `Z86073.JCL`, and `Z86073.LOAD`.

The project-owned expense cluster was provisioned on 2026-10-25 by `JOB04562` with `CC 0000`; IDCAMS created `Z86073.EXPTRK.MASTER` with `KEYS(12 0)` and `RECORDSIZE(80 80)`, plus its DATA and INDEX components. The employee KSDS was defined by `JOB05375`, loaded by `JOB05378`, and verified by `JOB05384`. Supporting datasets were allocated by `JOB05388`. `JOB05414` accepted `EX26102501A1`, `JOB05417` read it back from VSAM, and `JOB05423` generated a report containing the transaction and total. The existing `Z86073.VSAM.KSDS` and `Z86073.VSAMDS` were not redefined or used.

On 2026-10-26, live browser-to-FastAPI verification succeeded through the isolated allocation path. `JOB07939` ran `EXPPOST` with `CC 0000`; JES reported `READ=1 POSTED=1 REJECTED=0` for `EX261026E05`. The API matched the result record and returned `posted` with processing reference `OK`. `JOB07942` ran `EXPRPT` with `CC 0000`, and the live report endpoint returned `EX261026E05`. The earlier shared-dataset lock and SMS/ACS dynamic-allocation failures remain preserved in the runtime ledger as failed attempts and were not retried.
