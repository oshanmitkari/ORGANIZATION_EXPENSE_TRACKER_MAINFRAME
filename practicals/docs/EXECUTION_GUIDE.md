# Execution Guide - z/OS Deployment

## Overview
This guide describes how to deploy and run the practicals artifacts on IBM Z (z/OS) using Zowe Explorer and IBM Z Xplore.

## Prerequisites
- z/OS system access (IBM Z Xplore or equivalent)
- Zowe CLI and Zowe Explorer for VS Code
- Authorized HLQ (High Level Qualifier) for dataset allocation
- GnuCOBOL not required on z/OS - use IBM Enterprise COBOL

## Dataset Allocation Strategy
All datasets use configurable HLQ via `//SET HLQ=&SYSUID` in JCL.
Default: `&SYSUID.` (your TSO user ID)

## Step-by-Step Deployment

### 1. Upload Source Files via Zowe Explorer
1. Connect to z/OS in Zowe Explorer
2. Create partitioned datasets:
   - `HLQ.JCLLIB` (FB 80) - JCL members
   - `HLQ.COBLIB` (FB 80) - COBOL source
   - `HLQ.REXXLIB` (FB 80) - REXX execs
   - `HLQ.COPYLIB` (FB 80) - Copybooks
3. Upload files:
   ```
   practicals/JCL/*.jcl          → HLQ.JCLLIB
   practicals/COBOL/*.cbl        → HLQ.COBLIB
   practicals/REXX/*.rexx        → HLQ.REXXLIB
   practicals/COPY/*.cpy         → HLQ.COPYLIB
   ```

### 2. Compile COBOL Programs
Use your site's standard COBOL compile procedure (e.g., `IGYWCLG` or `COBCL`):

```jcl
//COBCOMP  JOB (ACCT),'COBOL COMPILE',CLASS=A,MSGCLASS=X
//STEP1    EXEC PROC=IGYWCLG
//COBOL.SYSIN DD DSN=HLQ.COBLIB(ASSIGN2MT),DISP=SHR
//COBOL.SYSLIB DD DSN=HLQ.COPYLIB,DISP=SHR
//LKED.SYSLMOD DD DSN=HLQ.LOADLIB(ASSIGN2MT),DISP=SHR
```

Compile all:
- `ASSIGN2MT` (practicals/COBOL/ASSIGN2_MATCH.cbl)
- `VALIDCNT` (practicals/COBOL/VALIDATE_COUNT.cbl)
- `VSAMLOOK` (practicals/JCL/VSAM/VSAMLOOK.cbl)

### 3. Create VSAM Clusters
Submit `practicals/JCL/VSAM/VSAM-DEFINE.jcl`:
```bash
zowe jobs submit local practicals/JCL/VSAM/VSAM-DEFINE.jcl
```
Verify:
- `HLQ.EXPENSE.MASTER` (KSDS) - employee master
- `HLQ.EXPENSE.AUDIT` (ESDS) - audit log
- `HLQ.BATCH.CONTROL` (RRDS) - batch control

### 4. Load Employee Master into KSDS
Ensure `HLQ.EMPLOYEE.MASTER` (PS, 80-byte, key at 21-28) exists and is sorted by key.
The `LOADKS` step in VSAM-DEFINE.jcl does this via REPRO.

### 5. Prepare Test Data
Upload test fixtures as sequential datasets:
```bash
# Using Zowe CLI
zowe files upload file-to-data-set practicals/TESTDATA/assign2_trans50.txt \
  "HLQ.EXPENSE.TRANS50" --binary
zowe files upload file-to-data-set practicals/TESTDATA/assign2_master50.txt \
  "HLQ.EMPLOYEE.MASTER50" --binary
```

### 6. Run Assignment Jobs

#### Assignment 1: SORT Dedupe
```bash
zowe jobs submit local practicals/JCL/ASSIGN1_SORT_DEDUP.jcl
```
Check: `HLQ.EXPENSE.CLEAN.VARA` (90 records), `HLQ.EXPENSE.CLEAN.VARB` (90 records)

#### Assignment 2: COBOL Match
```bash
zowe jobs submit local practicals/JCL/ASSIGN2_MATCH.jcl
```
Check: `HLQ.EXPENSE.MATCHED` (35 records), `HLQ.EXPENSE.UNMATCHED` (15 records)

#### Assignment 3: REXX Dedupe/Sort
```bash
zowe jobs submit local practicals/JCL/ASSIGN3_RUN.jcl
```
Check: `HLQ.EXPENSE.CLEAN100` (105 records)

#### Assignment 4: Sort + Validate
```bash
zowe jobs submit local practicals/JCL/ASSIGN4_SORT_VALIDATE.jcl
```
Check: `HLQ.EXPENSE.REPORT` exists only on SUCCESS path

#### VSAM Match
```bash
zowe jobs submit local practicals/JCL/VSAM/VSAM-MATCH.jcl
```
Check: `HLQ.EXPENSE.MATCHED`, `HLQ.EXPENSE.UNKNOWN`

### 7. Read Return Codes from Spool
```bash
# List recent jobs
zowe jobs list --prefix HLQ

# Get job output
zowe jobs view job-output-by-jobid JOB12345

# Check specific step RC
zowe jobs view job-output-by-jobid JOB12345 --step-name VALID
```

## Zowe CLI Commands Reference

### Dataset Operations
```bash
# Allocate dataset
zowe files allocate data-set "HLQ.NEW.FILE" --recfm FB --lrecl 80 --space-trk 5 5

# Upload file
zowe files upload file-to-data-set local.txt "HLQ.TARGET.FILE" --binary

# Download dataset
zowe files download data-set "HLQ.SOURCE.FILE" local.txt --binary

# List datasets
zowe files list data-set "HLQ.**"

# Delete dataset
zowe files delete data-set "HLQ.OLD.FILE" --force
```

### Job Operations
```bash
# Submit JCL
zowe jobs submit local myjob.jcl

# Submit from dataset
zowe jobs submit data-set "HLQ.JCLLIB(JOBNAME)"

# List jobs
zowe jobs list --prefix MYUSER --status OUTPUT

# View job output
zowe jobs view job-output-by-jobid JOB12345

# Get step return codes
zowe jobs view job-output-by-jobid JOB12345 --step-name STEPNAME
```

### VSAM Operations
```bash
# Define cluster
zowe files call "IDCAMS" --parameters "DEFINE CLUSTER (NAME(HLQ.TEST) INDEXED KEYS(8 20) RECORDSIZE(80 80))"

# Repro load
zowe files call "IDCAMS" --parameters "REPRO INFILE(HLQ.PSFILE) OUTFILE(HLQ.KSDS)"

# List catalog
zowe files call "IDCAMS" --parameters "LISTCAT ENTRIES(HLQ.KSDS) ALL"
```

## Return Code Verification

### JCL Return Codes
| Step | Expected RC | Meaning |
|------|-------------|---------|
| SORT/COPY | 0 | Success |
| SORT | 4 | Empty input |
| SORT | 16 | Capacity exceeded |
| COBOL | 0 | Success |
| COBOL | 4 | Warning (unmatched, etc.) |
| COBOL | 12 | File error |
| ICETOOL | 0 | Success |
| ICETOOL | 4 | Empty input (with EMPTY RC4) |
| IDCAMS | 0 | Success |
| IDCAMS | 4 | Warning |
| IDCAMS | 8/12 | Error |

### Conditional Execution
```jcl
// IF (STEP1.RC = 0) THEN
//   Copy temp to final
// ELSE
//   Print error, delete temp, SET MAXCC=12
// ENDIF
```

## Troubleshooting Common Issues

| Issue | Resolution |
|-------|------------|
| S806 on COBOL | Check STEPLIB points to HLQ.LOADLIB |
| IEC030I DCB mismatch | Verify LRECL/RECFM match in DD and FD |
| S0C7 in COBOL | Check numeric fields, PIC 9 vs PIC X |
| VSAM open error | Verify cluster exists, DISP=SHR |
| KSDS full (RC=34) | EXPORT/IMPORT to larger cluster |
| REXX RC=20 | Syntax error - check PARSE, quotes |
| REXX RC=28 | Command not found - check SYSEXEC |

## Cleanup
```jcl
//CLEANUP EXEC PGM=IDCAMS
//SYSPRINT DD SYSOUT=*
//SYSIN DD *
  DELETE HLQ.EXPENSE.CLEAN.VARA CLUSTER PURGE
  DELETE HLQ.EXPENSE.CLEAN.VARB CLUSTER PURGE
  DELETE HLQ.EXPENSE.MATCHED CLUSTER PURGE
  DELETE HLQ.EXPENSE.UNMATCHED CLUSTER PURGE
  DELETE HLQ.EXPENSE.CLEAN100 CLUSTER PURGE
  DELETE HLQ.EXPENSE.REPORT CLUSTER PURGE
  DELETE HLQ.EXPENSE.MASTER CLUSTER PURGE
  DELETE HLQ.EXPENSE.AUDIT CLUSTER PURGE
  DELETE HLQ.BATCH.CONTROL CLUSTER PURGE
/*
```

## Verification Checklist
- [ ] All JCL submitted without JCL errors
- [ ] COBOL programs compiled with RC=0
- [ ] VSAM clusters defined (LISTCAT shows them)
- [ ] Employee master loaded into KSDS (REPRO RC=0)
- [ ] Assignment 1 outputs: 90 records each variant
- [ ] Assignment 2 outputs: 35 matched, 15 unmatched
- [ ] Assignment 3 output: 105 records
- [ ] Assignment 4: REPORT exists on SUCCESS, absent on FAILURE
- [ ] VSAM MATCH runs with expected counts
- [ ] All job logs show RC=0 (or expected RC=4/12)

## Notes
- All JCL uses `&SYSUID` for HLQ - change via `//SET HLQ=MYHLQ`
- Temporary datasets use `&&TEMPNAME` - auto-deleted
- No destructive operations without PURGE confirmation
- Keep job logs for audit trail