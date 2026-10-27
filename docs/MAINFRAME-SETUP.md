# z/OS Setup and Operations

These are deployment templates. Review them with the authorized site operations and DB2 teams before use. The dedicated employee and expense resources were provisioned in the project namespace, and controlled COBOL posting, readback, and reporting were verified on 2026-10-25. Existing coursework clusters were not modified.

1. Allocate transaction, clean, matched, valid and report PS datasets as `RECFM=FB,LRECL=80`. Exception records containing an 80-byte transaction plus a 30-byte reason use `LRECL=110`. Confirm every actual COBOL FD and DD uses the same contract.
2. Upload `EXPENSE-REC.cpy`, COBOL, JCL, and REXX sources to approved libraries using the site's transfer and encoding standards. Upload `mainframe/rexx/EXPMON.rexx` to the approved `&SYSUID..REXX` exec library before using `mainframe/jcl/EXPMON.jcl`.
3. Compile `MATCH2.cbl`, `EXPVALID.cbl`, `CNTCHECK.cbl`, and `VSAMLOOK.cbl` using the authorized compiler procedure. Precompile, compile, link-edit, and bind `db2/POSTEXP.sqc` with the site Db2 procedure, then set its plan and libraries in `db2/POSTEXP.jcl`.
4. Seed the project transaction/master records with the verified 80-byte layout in `mainframe/copybooks/EXPCOPY.cpy`. The project-owned employee KSDS is `Z86073.EXPTRK.EMPLOYEE`: FB80, key offset 0, key length 8, with `ID(8)|NAME(30)|DEPT(10)|STATUS(1)|FILLER(31)`. The seed contains fictional IDs `E0001001`, `E0001002`, `E0001003`, and inactive `E0001004`.
5. Run isolated SORT, ICETOOL, COBOL, VSAM, and Db2 stages in a disposable test HLQ/schema first. Check JES output, DD allocation, record counts, and return codes at each stage.
6. `VSAM-DEFINE.jcl` is non-destructive and fails when the cluster already exists. It defines and then loads the PS employee master into the KSDS only when the DEFINE step succeeds. Use a disposable HLQ and verify allocation and input sort order first.
7. Run DB2 DDL only in an authorized development schema after DBA review. This project does not include a verified fixed-width-to-DB2 loader or live Node connection.
8. RACF examples are illustrative and require site-specific profiles and an authorized administrator. Do not submit them with placeholder group or HLQ values.
9. Retain approved job logs and output evidence for both successful count control and intentional failure. Do not use real personal or financial data in local fixtures.

## REXX automation step

`mainframe/jcl/EXPMON.jcl` is the controlled automation wrapper for `mainframe/rexx/EXPMON.rexx`. Submit it after `EXPPOST.jcl` has completed and the result dataset is available. It runs under `IKJEFT01`, reads only `Z86073.EXPTRK.RESULT`, prints a bounded summary to `SYSTSPRT`, and returns a useful condition code for a scheduler or operator:

| Return code | Meaning | Operational action |
|---:|---|---|
| 0 | Every parsed result is `POSTED` | Continue to report/readback checks |
| 4 | Records are valid but at least one is `REJECTED` | Review exceptions; do not treat the batch as fully successful |
| 12 | Missing/unreadable output, malformed record, or unknown status | Stop and investigate JES, DD, dataset, or program output |

The REXX utility validates the dataset-name argument, allocates the result dataset read-only, uses `EXECIO` to inspect pipe-delimited result records, frees the allocation, and does not submit jobs or accept arbitrary client commands. TSO/E execution still requires target-site validation; local Node and FastAPI tests do not execute REXX.

Dataset names, compiler procedures, DB2 subsystem, RACF permissions, utility options, encoding, and storage allocation vary by installation. Treat the supplied artifacts as adaptable templates, not portable certified production jobs.

## Live API transaction allocation

The live FastAPI path does not write concurrent requests into the shared `Z86073.EXPTRK.TRAN`. With `TRANSACTION_DATASET_MODE=per-request` (the default), it generates a unique `Z86073.EXPTRK.TXN.*` name, submits an `IEFBR14` allocation job using the confirmed `UNIT=SYSDA`/FB80 pattern, waits for allocation `CC 0000`, uploads one transaction, and submits `EXPPOST` with a request-specific `TRANSIN` DD. This avoids the `IKJ56225I DATA SET ... ALREADY IN USE` failure seen with the shared input dataset. The account's z/OSMF dynamic allocation endpoint returned an SMS/ACS error, so the known-working JCL allocation route is intentional.

The application normalizes z/OSMF's nested job response fields. It does not mark a request `posted` until `EXPPOST` completes and the matching pipe-delimited result record is found. A fresh live verification on 2026-10-26 used `EX261026E05`: allocation succeeded, `JOB07939` returned `CC 0000` with `POSTED=1`, and `JOB07942` refreshed the report with `CC 0000`.

## Confirmed commands and permissions

The authenticated profile successfully ran these read-only/compile-safe operations:

```bash
ZOWE_CLI_HOME=/home/krishna-lokhande/.zowe zowe zosmf check status --response-format-json
ZOWE_CLI_HOME=/home/krishna-lokhande/.zowe zowe zos-files list data-set 'Z86073.*' --attributes --response-format-json
ZOWE_CLI_HOME=/home/krishna-lokhande/.zowe zowe zos-jobs list jobs --owner Z86073 --prefix '*' --response-format-json
ZOWE_CLI_HOME=/home/krishna-lokhande/.zowe zowe zos-jobs list spool-files-by-jobid JOB02996 --response-format-json
ZOWE_CLI_HOME=/home/krishna-lokhande/.zowe zowe zos-jobs view spool-file-by-id JOB02996 101 --encoding IBM-1047 --response-format-json
```

The account has verified read access to the listed datasets, PDS member upload access, compile/link access through `IGYWCL`, IDCAMS dataset-definition permission, job submission access, and JES spool retrieval access. `JOB04562` completed with `CC 0000` and created `Z86073.EXPTRK.MASTER` with `KEYS(12 0)` and `RECORDSIZE(80 80)`, plus its DATA and INDEX components.

For a fresh checkout, upload only after confirming the member names are absent:

```bash
ZOWE_CLI_HOME=/home/krishna-lokhande/.zowe zowe zos-files upload file-to-data-set mainframe/copybooks/EXPCOPY.cpy 'Z86073.SOURCE(EXPCOPY)' --encoding IBM-1047
ZOWE_CLI_HOME=/home/krishna-lokhande/.zowe zowe zos-files upload file-to-data-set mainframe/cobol/EXPPOST.cbl 'Z86073.CBL(EXPPOST)' --encoding IBM-1047
ZOWE_CLI_HOME=/home/krishna-lokhande/.zowe zowe zos-files upload file-to-data-set mainframe/cobol/EXPREAD.cbl 'Z86073.CBL(EXPREAD)' --encoding IBM-1047
ZOWE_CLI_HOME=/home/krishna-lokhande/.zowe zowe zos-files upload file-to-data-set mainframe/cobol/EXPRPT.cbl 'Z86073.CBL(EXPRPT)' --encoding IBM-1047
```

Compile-only submission uses the confirmed procedure and variable-format local JCL:

```bash
ZOWE_CLI_HOME=/home/krishna-lokhande/.zowe zowe zos-jobs submit local-file mainframe/jcl/VERIFY-EXPPOST.jcl --job-record-format V --wait-for-output --response-format-json
```

The employee workflow is separate and rerunnable: `EMPDEF.jcl` defines only when the cluster is absent, `EMPALLOC.jcl` allocates the FB80 seed, and `EMPLOAD.jcl` is submitted only after a successful define and empty/controlled target check. `JOB05375` defined the employee KSDS, `JOB05378` loaded four records, and `JOB05384` keyed-read `E0001001` as active `Alice Johnson`.

The controlled runtime used a one-record bootstrap seed because an empty expense KSDS opened with VSAM status 35 in this environment (`JOB05407`). `JOB05412` loaded that single synthetic record, after which `JOB05414` posted the unique test expense `EX26102501A1` with `CC 0000` and `POSTED=1`. `JOB05417` returned `EX26102501A1|FOUND`, and `JOB05423` produced both detail records and `TOTAL|000000002|000000000012445`.
