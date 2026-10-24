# Dataset Concepts Reference

## PS (Physical Sequential)
- **Organization**: Sequential, no keys
- **Access**: Sequential only (TOP to BOTTOM)
- **RECFM**: FB (Fixed Block) or VB (Variable Block)
- **LRECL**: Logical record length (e.g., 80, 100, 110)
- **BLKSIZE**: Block size (0 = system determined)
- **DISP**: NEW/CATLG/DELETE, SHR, OLD, MOD
- **Use case**: Batch input/output, sort work files, reports

## PDS (Partitioned Data Set)
- **Organization**: Directory + members (like a library)
- **Access**: Member-level (directory lookup)
- **RECFM**: FB or VB
- **Directory blocks**: Specified in SPACE=(TRK,(n,m),RLSE) where m = directory blocks
- **Use case**: Source code libraries (JCL, COBOL, REXX), load modules
- **Limitation**: Fixed directory size, no member compression

## PDSE (PDS Extended)
- **Organization**: PDS with dynamic directory, member compression
- **Access**: Member-level, faster directory search
- **Features**: Unlimited members, automatic compression, DFSMS managed
- **Use case**: Modern load libraries, large source libraries

## VSAM KSDS (Key Sequenced Data Set)
- **Organization**: Indexed by key, B-tree structure
- **Components**: DATA (records) + INDEX (key pointers)
- **Key**: Defined by KEYS(length offset) - offset is 0-based
- **FREESPACE**: CI% CA% - free space for inserts (CI=Control Interval, CA=Control Area)
- **SHAREOPTIONS**: Cross-region/share rules (2 3 = multi-read, single-write)
- **Access modes**: Sequential, Direct (by key), Skip-sequential
- **Splits**: CI split (within CA), CA split (new CA) - caused by inserts
- **Use case**: Employee master, reference data requiring keyed access

## VSAM ESDS (Entry Sequenced Data Set)
- **Organization**: Sequential by entry order (RBA - Relative Byte Address)
- **Components**: DATA only (no index)
- **Access**: Sequential, Direct by RBA
- **No keys**: Records appended at end, cannot be deleted (only marked)
- **Use case**: Audit logs, sequential journals, timestamp-ordered data

## VSAM RRDS (Relative Record Data Set)
- **Organization**: Fixed-length slots by Relative Record Number (RRN)
- **Components**: DATA only (slots 1..N)
- **Access**: Direct by RRN, Sequential
- **Fixed LRECL**: All records same length
- **Use case**: Batch control records (RRN = run number), fixed-slot tables

## VSAM LDS (Linear Data Set)
- **Organization**: Byte-stream, no record structure
- **Components**: DATA only
- **Access**: Byte-addressable (like a file system)
- **Not for COBOL**: Cannot use SELECT ... ORGANIZATION IS INDEXED/SEQUENTIAL/RELATIVE
- **Use case**: Db2 table spaces, system datasets, specialized apps

## DCB Parameters
| Parameter | Description | Typical Values |
|-----------|-------------|----------------|
| RECFM | Record format | FB, VB, F, V, FBS, VBS |
| LRECL | Logical record length | 80, 100, 110, 32756 |
| BLKSIZE | Block size | 0 (system), 27998, 32760 |
| DSORG | Dataset organization | PS, PO, VSAM |

## SPACE Allocation
- **TRK/CYL**: Tracks or Cylinders
- **Primary/Secondary**: (TRK,(5,5)) = 5 primary, 5 secondary
- **RLSE**: Release unused space at CLOSE
- **AVGREC**: Average record length (for system-managed)

## GDG (Generation Data Group)
- **Base name**: HLQ.GDGBASE
- **Generations**: G0001V00, G0002V00, etc.
- **Reference**: HLQ.GDGBASE(0) = current, (-1) = previous
- **Limit**: MAXGENS in model DSCB

## Temporary Datasets
- **&&TEMPNAME**: Job-step temporary (deleted at step end)
- **&TEMPNAME**: Job-level temporary (deleted at job end)
- **No DISP=CATLG**: Cannot be catalogued

## Common Abends
| Abend | Cause | Resolution |
|-------|-------|------------|
| S0C7 | Data exception (packed decimal) | Check numeric fields, PIC 9 vs PIC X |
| S806 | Load module not found | Check STEPLIB/JOBLIB, compile/link |
| S913 | Authorization failure | RACF profile, dataset access |
| IEC030I | DCB mismatch | Verify LRECL/RECFM/BLKSIZE match |
| SB37 | Out of space (primary) | Increase primary allocation |
| SD37 | Out of space (secondary) | Increase secondary or volumes |
| SE37 | Directory full (PDS) | Increase directory blocks or use PDSE |

## JCL DD Statement Key Parameters
```jcl
//DDNAME  DD DSN=HLQ.DATASET.NAME,DISP=(NEW,CATLG,DELETE),
//            UNIT=SYSDA,
//            SPACE=(TRK,(5,5),RLSE),
//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=0),
//            VOL=SER=VOL001
```
- **DSN**: Data set name (HLQ + qualifiers)
- **DISP**: (begin, normal-end, abnormal-end)
- **UNIT**: Device type (SYSDA = direct access)
- **VOL**: Specific volume (optional, usually SMS managed)