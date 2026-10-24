# JCL Guide - Compact Reference

## Core Utilities
| Utility | Purpose | Key Control Statements |
|---------|---------|------------------------|
| **IEFBR14** | Null program (allocate/delete datasets) | None (RC=0/4/12 via COND) |
| **IEBGENER** | Copy sequential datasets, print messages | GENERATE, RECORD, MEMBER |
| **IEBCOPY** | Copy PDS/PDSE members, compress | COPY INDD=,OUTDD=, SELECT MEMBER= |
| **IDCAMS** | VSAM define/delete/list/backup | DEFINE, DELETE, LISTCAT, REPRO, EXPORT, IMPORT |
| **SORT/DFSORT** | Sort, merge, dedupe, reformat | SORT FIELDS=, MERGE FIELDS=, SUM FIELDS=, INCLUDE/OMIT |
| **ICETOOL** | Count, stats, verify, display | COUNT, STATS, VERIFY, DISPLAY, SELECT |

## Dataset Types
### PS (Physical Sequential)
```jcl
//DD1 DD DSN=HLQ.FILE,DISP=(NEW,CATLG,DELETE),
//       UNIT=SYSDA,SPACE=(TRK,(10,5),RLSE),
//       DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)
```

### PDS (Partitioned Data Set)
```jcl
//DD1 DD DSN=HLQ.LIB,DISP=(NEW,CATLG,DELETE),
//       UNIT=SYSDA,SPACE=(TRK,(10,5,20),RLSE),  // 20 dir blocks
//       DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)
```

### PDSE (Extended)
```jcl
//DD1 DD DSN=HLQ.LIB,DISP=(NEW,CATLG,DELETE),
//       UNIT=SYSDA,SPACE=(TRK,(10,5),RLSE),
//       DCB=(RECFM=FB,LRECL=80,BLKSIZE=0),
//       DSNTYPE=LIBRARY
```

## FB vs VB Records
| Format | Description | Length Field |
|--------|-------------|--------------|
| **FB** | Fixed Block | LRECL = exact record length |
| **VB** | Variable Block | LRECL = max record + 4 (RDW) |
| **FBS** | FB Standard | Blocked FB |
| **VBS** | VB Standard | Blocked VB |

## SPACE Allocation
```jcl
// SPACE=(TRK,(primary,secondary,directory),RLSE)
// SPACE=(CYL,(5,2))
// SPACE=(TRK,(10,5,20))  // PDS: 20 directory blocks
// AVGREC=K  // System-managed (SMS)
```

## DCB Parameters
| Param | Meaning | Example |
|-------|---------|---------|
| RECFM | Record format | FB, VB, FBA, VBA |
| LRECL | Logical record length | 80, 100, 110 |
| BLKSIZE | Physical block size | 0 (auto), 27920 |
| BUFNO | Buffers | 5-20 |
| DSORG | Dataset org | PS, PO, DA |

## Symbolic Parameters & SET
```jcl
//SET HLQ=MYHLQ
//SET DATE=20261024
//STEP1 EXEC PGM=SORT
//SORTIN DD DSN=&HLQ..INPUT.&DATE,DISP=SHR
```

## Temporary Datasets
```jcl
//TEMP DD DSN=&&TEMPNAME,DISP=(NEW,PASS),  // Job-step temp
//       UNIT=SYSDA,SPACE=(TRK,(5,5)),
//       DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)

//TEMP2 DD DSN=&TEMPNAME,DISP=(NEW,PASS)    // Job-level temp
```

## GDG (Generation Data Group)
```jcl
// Model DSCB defines MAXGENS
// Reference in JCL:
/INPUT DD DSN=HLQ.GDGBASE(0),DISP=SHR    // Current
/INPUT DD DSN=HLQ.GDGBASE(-1),DISP=SHR   // Previous
/OUTPUT DD DSN=HLQ.GDGBASE(+1),DISP=(NEW,CATLG,DELETE)
```

## PROCs with Overrides
```jcl
//PROCNAME PROC PGM=SORT,HLQ=DEFAULT
//SORT    EXEC PGM=&PGM
//SORTIN  DD DSN=&HLQ..INPUT,DISP=SHR
//        PEND

// Call with overrides:
//STEP1 EXEC PROCNAME,PGM=ICETOOL,HLQ=MYHLQ
```

## COND vs IF/THEN/ELSE
### COND (Legacy)
```jcl
//STEP2 EXEC PGM=PROG2,COND=(0,NE,STEP1)  // Run if STEP1 RC=0
//STEP3 EXEC PGM=PROG3,COND=(4,LT,STEP2)  // Run if STEP2 RC < 4
```

### IF/THEN/ELSE (Modern)
```jcl
// IF (STEP1.RC = 0) THEN
//STEP2 EXEC PGM=PROG2
// ELSE
//STEP3 EXEC PGM=PROG3
// ENDIF
```

## DD * vs DD DATA
| Type | Delimiter | Variable Substitution |
|------|-----------|----------------------|
| **DD *** | `/*` | Yes (symbolic params resolved) |
| **DD DATA** | `//` (next JCL statement) | No (literal) |

## RESTART
```jcl
//JOBNAME JOB ...,RESTART=STEP3
//       Or: RESTART=STEP3.PROCSTEP
//       Or: RESTART=* (from last checkpoint)
```

## Common Abends
| Abend | Meaning | Typical Cause |
|-------|---------|---------------|
| **S0C1** | Operation exception | Bad branch, corrupted code |
| **S0C4** | Protection exception | Bad subscript, null pointer |
| **S0C7** | Data exception | Non-numeric in PIC 9, COMP-3 |
| **S0CB** | Division by zero | DIVIDE with zero divisor |
| **S806** | Load module not found | Missing STEPLIB, failed link |
| **S80A** | Insufficient virtual storage | REGION too small |
| **S913** | Authorization failure | RACF deny, wrong profile |
| **IEC030I** | DCB conflict | LRECL/RECFM mismatch |
| **SB37** | Out of space (primary) | Increase SPACE primary |
| **SD37** | Out of space (secondary) | Increase secondary/volumes |
| **SE37** | PDS directory full | More dir blocks or PDSE |

## DFSORT Control Cards
```jcl
//SYSIN DD *
  SORT FIELDS=(13,8,CH,A,1,80,CH,A)   // Sort by key then full record
  SUM FIELDS=NONE                      // Remove exact duplicates
  SORT FIELDS=(33,9,CH,D)              // Descending by amount
  INCLUDE COND=(29,4,CH,EQ,C'FOOD')   // Filter
  OUTREC FIELDS=(1:1,80)               // Reformat
/*
```

## ICETOOL Examples
```jcl
//TOOLIN DD *
  COUNT FROM(IN) EMPTY RC4             // Count records, RC=4 if empty
  STATS FROM(IN) ON(33,9,CH)           // Min/Max/Mean of amount
  DISPLAY FROM(IN) LIST(REPORT) -
    TITLE('Expense Report') -
    ON(13,8,CH) ON(33,9,CH) -
    ON(21,8,CH)
  VERIFY FROM(IN) ON(21,8,CH)          // Verify sort order
/*
```

## SORT Dedupe Variants
| Variant | SORT FIELDS | SUM FIELDS | Keeps |
|---------|-------------|------------|-------|
| **Full-record** | `(13,8,CH,A,1,80,CH,A)` | NONE | First after full-record sort |
| **Key-only** | `(13,8,CH,A),EQUALS` | NONE | First input order per key (EQUALS) |

## Return Codes
| RC | Meaning |
|----|---------|
| 0 | Success |
| 4 | Warning (e.g., duplicates found, empty input) |
| 8 | Error (validation mismatch) |
| 12 | Severe error (file open, abend) |
| 16 | Catastrophic (SORT capacity exceeded) |