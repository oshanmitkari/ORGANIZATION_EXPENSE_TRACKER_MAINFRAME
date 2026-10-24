# VSAM Guide - Concepts and Operations

## VSAM Dataset Types Comparison

| Feature | KSDS | ESDS | RRDS | LDS |
|---------|------|------|------|-----|
| **Access** | Keyed, Sequential, Skip-seq | Sequential, RBA | RRN, Sequential | Byte-stream |
| **Key** | User-defined (KEYS len offset) | None (RBA) | Relative Record Number | None |
| **Index** | Yes (B-tree) | No | No | No |
| **Deletes** | Supported | Mark only | Supported | N/A |
| **Inserts** | Supported (splits) | Append only | Slot-based | N/A |
| **Components** | DATA + INDEX | DATA only | DATA only | DATA only |
| **FREESPACE** | CI% CA% | No | No | No |
| **COBOL ORG** | INDEXED | SEQUENTIAL | RELATIVE | N/A |
| **COBOL ACCESS** | DYNAMIC/RANDOM/SEQUENTIAL | SEQUENTIAL | DYNAMIC/RANDOM/SEQUENTIAL | N/A |

## KSDS Deep Dive

### Control Interval (CI)
- **Unit of I/O**: 512 bytes to 32 KB (typically 4 KB)
- **Contains**: Records + free space + RDFs (Record Definition Fields) + CIDF
- **Split**: When insert needs space and CI full → CI split (50/50 within same CA)

### Control Area (CA)
- **Group of CIs**: 1 to many CIs (typically 4-16 CIs = 16-64 KB)
- **Split**: When CI split would exceed CA → CA split (new CA, index updated)
- **FREESPACE(CI% CA%)**: e.g., FREESPACE(20 10) = 20% free in each CI, 10% free CIs in each CA

### Index Component
- **Sequence Set**: Lowest level, points to CIs
- **Index Set**: Higher levels, points to Sequence Set CIs
- **Root**: Top level (1 record)

### Key Definition
```jcl
KEYS(8 20)   // Length 8, offset 20 (0-based = columns 21-28)
```

### SHAREOPTIONS
```jcl
SHAREOPTIONS(2 3)   // Cross-region: 2=multi-read, 3=exclusive write
```
| Cross-region | Meaning |
|--------------|---------|
| 1 | Single user (no sharing) |
| 2 | Multi-read, single write |
| 3 | Multi-read, multi-write (full sharing) |
| 4 | Multi-read, multi-write with buffering |

## ESDS (Entry Sequenced Data Set)
- **RBA (Relative Byte Address)**: 4-byte address from start of DATA
- **No deletes**: Records cannot be physically deleted (space not reused)
- **Use case**: Audit trail, log files, sequential archives
- **COBOL**: `ORGANIZATION IS SEQUENTIAL`, `ACCESS MODE IS SEQUENTIAL`
- **Alternate Index (AIX)**: Can build AIX for keyed access

## RRDS (Relative Record Data Set)
- **RRN**: 1-based slot number (1, 2, 3...)
- **Fixed LRECL**: All slots same size
- **Empty slots**: Binary zeros (can be distinguished from valid data)
- **Use case**: Fixed-slot tables, batch run control (RRN = run #)
- **COBOL**: `ORGANIZATION IS RELATIVE`, `RELATIVE KEY IS WS-RRN`

## LDS (Linear Data Set)
- **No record structure**: Byte-stream like UNIX file
- **Not for COBOL**: Cannot use standard COBOL file I/O
- **Use case**: Db2 table spaces, system datasets, UNIX file system on z/OS
- **Access**: VSAM LDS API, memory mapping

## IDCAMS Commands

### DEFINE CLUSTER
```jcl
DEFINE CLUSTER (NAME(HLQ.DATASET) -
  INDEXED KEYS(8 20) RECORDSIZE(80 80) -
  FREESPACE(20 10) SHAREOPTIONS(2 3)) -
  DATA (NAME(HLQ.DATASET.DATA) CYLINDERS(5 2)) -
  INDEX (NAME(HLQ.DATASET.INDEX) CYLINDERS(1 1))
```

### REPRO (Load/Backup/Copy)
```jcl
// Load PS to KSDS
REPRO INFILE(PSDD) OUTFILE(KSDSDD) REUSE

// Backup KSDS to PS
REPRO INFILE(KSDSDD) OUTFILE(PSDD)

// KSDS to KSDS (different HLQ)
REPRO INFILE(SRC) OUTFILE(TGT) REUSE
```

### EXPORT/IMPORT (Portable Backup)
```jcl
// Export to portable format (can move across systems)
EXPORT SRC(KSDSDD) OUTFILE(EXPDD) TEMPORARY

// Import from portable format
IMPORT INFILE(EXPDD) OUTDATASET(HLQ.NEW.DATASET)
```

### LISTCAT
```jcl
LISTCAT ENTRIES(HLQ.DATASET) ALL   // Full catalog info
LISTCAT ENTRIES(HLQ.DATASET) HISTORY  // Statistics
```

### DELETE
```jcl
DELETE HLQ.DATASET CLUSTER PURGE   // PURGE ignores retention
```

### ALTER
```jcl
ALTER HLQ.DATASET FREESPACE(30 15)  // Change freespace (requires reorganize)
ALTER HLQ.DATASET ADDVOLUMES(VOL002)  // Extend to another volume
```

## COBOL File Control for VSAM

### KSDS (INDEXED)
```cobol
SELECT EMPLOYEE-FILE ASSIGN TO EMPKSDS
    ORGANIZATION IS INDEXED
    ACCESS MODE IS DYNAMIC
    RECORD KEY IS EMPLOYEE-KEY
    ALTERNATE RECORD KEY IS EMP-NAME WITH DUPLICATES
    FILE STATUS IS FS-EMP.
```

### ESDS (SEQUENTIAL)
```cobol
SELECT AUDIT-FILE ASSIGN TO AUDITESDS
    ORGANIZATION IS SEQUENTIAL
    ACCESS MODE IS SEQUENTIAL
    FILE STATUS IS FS-AUDIT.
```

### RRDS (RELATIVE)
```cobol
SELECT BATCH-CTL ASSIGN TO BATCHRRDS
    ORGANIZATION IS RELATIVE
    ACCESS MODE IS DYNAMIC
    RELATIVE KEY IS WS-RRN
    FILE STATUS IS FS-BATCH.
```

## COBOL VSAM Operations

| Operation | KSDS | ESDS | RRDS |
|-----------|------|------|------|
| Sequential READ | `READ file NEXT` | `READ file NEXT` | `READ file NEXT` |
| Random READ by key | `READ file KEY IS key` | N/A | N/A |
| Random READ by RBA | N/A | `READ file KEY IS rba` | N/A |
| Random READ by RRN | N/A | N/A | `READ file KEY IS rrn` |
| WRITE (insert) | `WRITE record` | `WRITE record` (append) | `WRITE record` |
| REWRITE (update) | `REWRITE record` | N/A | `REWRITE record` |
| DELETE | `DELETE file` | N/A | `DELETE file` |
| START (position) | `START file KEY IS key` | N/A | `START file KEY IS rrn` |

## Common VSAM File Status Codes
| Code | Meaning |
|------|---------|
| 00 | Success |
| 02 | Duplicate key (WRITE/REWRITE) |
| 04 | End of file (READ NEXT) |
| 10 | End of file (READ NEXT) - alternate |
| 21 | Key not found (READ KEY) |
| 22 | Duplicate key on alternate index |
| 23 | Record not found (READ KEY) |
| 24 | Boundary violation |
| 30 | Permanent I/O error |
| 34 | No space (KSDS full) |
| 35 | Resource not available |
| 37 | Length error |
| 90 | Logic error (invalid request) |
| 92 | Key length error |
| 97 | File not open |

## CI/CA Split Impact
- **CI Split**: Minimal impact, records redistributed within CA
- **CA Split**: Higher impact, index updated, may cause cascading splits
- **Prevention**: FREESPACE, batch inserts sorted by key, periodic REORG
- **Monitoring**: LISTCAT HISTORY shows CI/CA splits count

## GnuCOBOL INDEXED Files (NOT VSAM)
```cobol
SELECT FILE ASSIGN TO "filename"
    ORGANIZATION IS INDEXED
    ACCESS MODE IS DYNAMIC
    RECORD KEY IS KEY-FIELD.
```
- Creates `.idx` and `.dat` files in current directory
- Uses ISAM-style indexing (not VSAM B-tree)
- No FREESPACE, SHAREOPTIONS, CI/CA concepts
- **Label as**: "GnuCOBOL INDEXED - NOT VSAM"

## Performance Guidelines
1. **Load sorted**: REPRO sorted input → no splits during load
2. **FREESPACE**: 20% CI, 10% CA for active insert workloads
3. **BUFNO**: Increase for sequential (BUFNO=10-20)
4. **LSR pools**: Local Shared Resources for multi-file access
5. **AIX**: Alternate indexes for secondary key access
6. **REORG**: Periodic EXPORT/IMPORT or REPRO to new cluster