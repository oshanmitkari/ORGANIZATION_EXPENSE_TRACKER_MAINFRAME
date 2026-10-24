# Troubleshooting Guide

## COBOL Compilation Errors (GnuCOBOL / IBM Enterprise COBOL)

### "invalid indicator at column 7"
- **Cause**: Comment `*` not in column 7
- **Fix**: Ensure 6 spaces before `*` in column 1-6 area
- **GnuCOBOL**: Strict fixed-form; column 7 must be `*` or space

### "PROGRAM-ID header missing"
- **Cause**: IDENTIFICATION DIVISION not recognized
- **Fix**: Check column alignment, no tabs, proper divisions

### "field does not have a FALSE clause"
- **Cause**: `SET condition-name TO FALSE` used
- **Fix**: Use `MOVE 'N' TO condition-switch` instead
- **Note**: 88-level conditions only have VALUE (TRUE), no FALSE clause

### "KEY-FOUN not defined"
- **Cause**: Line exceeds 72 columns, truncated
- **Fix**: Break long lines with continuation (hyphen in column 7)

### "line not terminated by newline"
- **Cause**: Missing newline at end of file
- **Fix**: Ensure file ends with newline

### COPY statement not found
- **Cause**: Copybook not in SYSLIB/SYSCPY
- **Fix**: Add `//COBOL.SYSLIB DD DSN=HLQ.COPYLIB,DISP=SHR` to compile JCL

## Runtime Errors (File Status Codes)

### FS=39 (Conflict - record length mismatch)
- **Cause**: FD LRECL doesn't match dataset DCB
- **Fix**: Verify `RECORDING MODE F` and LRECL match JCL DCB

### FS=92 (Logic error - file not open)
- **Cause**: READ/WRITE on unopened file
- **Fix**: Check OPEN statement executed, no GOTO bypassing it

### FS=30 (Permanent I/O error)
- **Cause**: Dataset damaged, hardware error, or DCB mismatch
- **Fix**: Recreate dataset, verify DCB parameters

### FS=34 (Boundary violation)
- **Cause**: WRITE beyond allocated space
- **Fix**: Increase SPACE allocation or use RLSE

### FS=37 (Length error)
- **Cause**: Record length != LRECL
- **Fix**: Ensure all records exactly LRECL bytes (no newlines in FB)

### FS=23 (Record not found - KSDS)
- **Cause**: Key doesn't exist in VSAM
- **Fix**: Check key value, load data, verify KEYS definition

### FS=22 (Duplicate key)
- **Cause**: WRITE with existing key
- **Fix**: Use REWRITE for updates, check for duplicates before WRITE

## JCL Errors

### S806 (Load module not found)
- **Cause**: STEPLIB/JOBLIB missing or wrong DSN
- **Fix**: Add `//STEPLIB DD DSN=HLQ.LOADLIB,DISP=SHR`

### S80A (Insufficient storage)
- **Cause**: REGION parameter too small
- **Fix**: Add `REGION=0M` or `REGION=4096K` to JOB/EXEC

### IEC030I (DCB conflict)
- **Cause**: DD DCB doesn't match program FD
- **Fix**: Match LRECL, RECFM, BLKSIZE exactly

### SB37/SD37/SE37 (Space)
- **Cause**: Primary/secondary space exhausted
- **Fix**: Increase SPACE primary/secondary, add volumes

### JCL Error: "Invalid DSNAME"
- **Cause**: `&SYSUID` not resolved, special chars
- **Fix**: Use `//SET HLQ=MYHLQ` at top, reference `&HLQ.`

### COND= not working as expected
- **Cause**: COND logic is inverse (EVEN/ONLY)
- **Fix**: Use IF/THEN/ELSE instead for clarity

## REXX Errors

### RC=20 (Syntax error)
- **Cause**: Unmatched quotes, bad PARSE template
- **Fix**: Check string literals, PARSE var positions

### RC=28 (Command not found)
- **Cause**: TSO command not recognized
- **Fix**: Use `address TSO` before commands, check SYSEXEC

### RC=12 (Allocation failed)
- **Cause**: Dataset doesn't exist, wrong DISP
- **Fix**: Verify DSN, use SHR for existing, NEW for new

### Stem variable not found
- **Cause**: `stem.0` not set, compound variable uninitialized
- **Fix**: Initialize `stem. = 0` before use

## VSAM Errors

### IDCAMS DEFINE fails (cluster exists)
- **Cause**: Non-destructive DEFINE
- **Fix**: DELETE first, or use different HLQ

### REPRO fails with "KEY NOT ASCENDING"
- **Cause**: Input PS not sorted by KSDS key
- **Fix**: SORT input by key before REPRO

### KSDS full (RC=34)
- **Cause**: No free space, too many records
- **Fix**: EXPORT/IMPORT to larger cluster with more FREESPACE

### SHAREOPTIONS conflict
- **Cause**: Multiple jobs updating same KSDS
- **Fix**: Use SHAREOPTIONS(2 3) or serialize with ENQ

## GnuCOBOL Specific (Local Development)

### "COBC not found"
- **Cause**: GnuCOBOL not installed or not in PATH
- **Fix**: `sudo apt install gnucobol` or set `COBC_PATH`

### Compilation hangs
- **Cause**: Large OCCURS tables, recursive COPY
- **Fix**: Increase memory, check for circular COPY

### "RECORDING MODE F" not supported
- **Cause**: Old GnuCOBOL version
- **Fix**: Upgrade to GnuCOBOL 3.1+

### DD_ environment variables not working
- **Cause**: Not set before exec
- **Fix**: Set `DD_DDNAME=/path/to/file` in env before spawn

### "binary data" warnings
- **Cause**: Non-printable chars in FB records
- **Fix**: Ensure all records printable, pad with spaces not nulls

## Test Validation Failures

### Record length mismatch
- **Expected**: 80 or 100 bytes exactly
- **Actual**: Check `Buffer.from(records.join(''))` not `join('\n')`

### Sort order mismatch
- **Cause**: Locale-dependent string compare
- **Fix**: Use `localeCompare` with explicit options, or binary compare

### Count mismatch
- **Cause**: Duplicate counting logic differs
- **Fix**: Match DFSORT exactly: `SUM FIELDS=NONE` removes consecutive after sort

## Node.js Test Runner Issues

### "Cannot find module"
- **Cause**: Wrong path in require()
- **Fix**: Use `path.join(__dirname, '..', 'TESTDATA')`

### Async/await not working
- **Cause**: Forgot `async` or `await`
- **Fix**: Ensure `main()` is `async` or use `.then()`

### Process exit codes
- **Cause**: `process.exit(1)` not caught
- **Fix**: Test runner checks exit code, use `try/catch`

## Zowe/IBM Z Xplore Issues

### "Connection refused"
- **Cause**: Zowe not running, wrong host/port
- **Fix**: Verify Zowe started, check `.zowe/config.json`

### "Access denied" on dataset
- **Cause**: RACF profile missing
- **Fix**: Request dataset access from security admin

### Job submit fails
- **Cause**: JCL syntax error, missing datasets
- **Fix**: Check JCL with `zowe jobs submit --dry-run`

### VSAM define fails
- **Cause**: Volume not available, SMS class missing
- **Fix**: Specify VOL=SER or use SMS managed storage

## Debugging Tips

### COBOL
```cobol
DISPLAY 'DEBUG: VAR=' VAR
DISPLAY 'FS=' FS-FILE
```

### REXX
```rexx
trace results
say 'DEBUG: var=' var
```

### JCL
```jcl
//SYSOUT DD SYSOUT=*
//SYSUDUMP DD SYSOUT=*   /* ABEND dump */
```

### Node.js
```javascript
console.log('DEBUG:', {var1, var2})
fs.writeFileSync('debug.bin', buffer)  // Inspect binary
```

## Getting Help

### Documentation
- IBM Enterprise COBOL Language Reference
- z/OS DFSORT Application Programming Guide
- z/OS TSO/E REXX Reference
- GnuCOBOL Manual (gnucobol.org)

### Project Resources
- `practicals/docs/JCL_GUIDE.md`
- `practicals/docs/VSAM_GUIDE.md`
- `practicals/docs/REXX_GUIDE.md`
- `practicals/docs/EXECUTION_GUIDE.md`

### Logs to Check
1. Job spool (JESMSGLG, JESJCL, SYSOUT)
2. COBOL compile listing (SYSPRINT)
3. Link-edit map (SYSLMOD)
4. IDCAMS SYSPRINT
5. Node test output