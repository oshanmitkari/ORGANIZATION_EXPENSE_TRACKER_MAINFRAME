# COBOL Guide - Project Patterns and Extensions

## Existing COBOL Programs (mainframe/)

| Program | Purpose | Key Features |
|---------|---------|--------------|
| **EXPDEDUP** | Sort + exact dedupe | Internal SORT, OUTPUT PROCEDURE, duplicate detection |
| **MATCH2** | Match transactions to employee master | In-memory table lookup, 88-level conditions, FILE STATUS |
| **EXPVALID** | Validate amount, date, category | Calendar date validation, leap year, category check |
| **EXPTOTAL** | Category/monthly totals | Ordered tables, break processing, STRING for labels |
| **EXPRPT** | Report sorted by amount desc | Internal SORT desc, BREAK_COUNT env var for test |
| **CNTCHECK** | Input/output count compare | RC 0/12, DISPLAY counts |
| **VSAMLOOK** | VSAM KSDS keyed lookup | ORG INDEXED, ACCESS DYNAMIC, INVALID KEY |

## Common Patterns Used

### File Control (DD names = ASSIGN TO names)
```cobol
ENVIRONMENT DIVISION.
INPUT-OUTPUT SECTION.
FILE-CONTROL.
    SELECT TRANS-FILE ASSIGN TO TRANSIN
        ORGANIZATION IS SEQUENTIAL
        FILE STATUS IS FS-TRANS.
```
- DD names via `DD_<NAME>` env vars (lib/cobol.js)
- `RECORDING MODE F` for fixed-length (no newlines)

### 88-Level Conditions (Boolean Flags)
```cobol
01  EOF-SW     PIC X VALUE 'N'.
   88 END-FILE    VALUE 'Y'.

01  FOUND-SW   PIC X VALUE 'N'.
   88 KEY-FOUND   VALUE 'Y'.
```
- Set TRUE: `SET END-FILE TO TRUE`
- Set FALSE: `MOVE 'N' TO EOF-SW` (no FALSE clause)

### File Status Handling
```cobol
01  FS-TRANS   PIC XX.

READ TRANS-FILE
EVALUATE FS-TRANS
  WHEN '00' PERFORM PROCESS-RECORD
  WHEN '10' SET END-FILE TO TRUE
  WHEN OTHER
    DISPLAY 'READ ERROR ' FS-TRANS
    MOVE 12 TO RETURN-CODE
END-EVALUATE.
```

### Internal SORT with OUTPUT PROCEDURE
```cobol
SD  SORT-FILE.
01  SORT-REC.
   05 SR-KEY   PIC X(08).
   05 SR-REST  PIC X(72).

PROCEDURE DIVISION.
    SORT SORT-FILE
         ON ASCENDING KEY SR-KEY
         USING INPUT-FILE
         OUTPUT PROCEDURE IS WRITE-OUTPUT.

WRITE-OUTPUT.
    RETURN SORT-FILE INTO WS-REC
       AT END SET SORT-DONE TO TRUE
       NOT AT END PERFORM EMIT-RECORD
    END-RETURN.
```

### In-Memory Table Lookup (MATCH2 pattern)
```cobol
01  KEY-TABLE.
   05 TBL-KEY OCCURS 5000 TIMES
      INDEXED BY IX PIC X(08).

LOAD-TABLE.
    READ MASTER-FILE
    MOVE MSTR-KEY TO TBL-KEY(KEY-CNT)

SEARCH-TABLE.
    SET IX TO 1
    PERFORM UNTIL IX > KEY-CNT OR KEY-FOUND
      IF TBL-KEY(IX) = SEARCH-KEY
         SET KEY-FOUND TO TRUE
      ELSE
         SET IX UP BY 1
      END-IF
    END-PERFORM.
```

### Return Codes
```cobol
MOVE 0  TO RETURN-CODE   /* Success */
MOVE 4  TO RETURN-CODE   /* Warning (unmatched, rejects) */
MOVE 12 TO RETURN-CODE   /* Error (file, logic) */
```

## Assignment 2 Extension: ASSIGN2_MATCH.cbl

### New Features
- **Two input files**: FILE1 (transactions, key 13-20), FILE2 (master, key 21-28)
- **Duplicate tracking**: Separate counts for master and transaction duplicates
- **Two key tables**: MASTER-TABLE and TRANS-TABLE
- **Comprehensive FILE STATUS**: All 4 files evaluated

### Key Differences from MATCH2
| Feature | MATCH2 | ASSIGN2_MATCH |
|---------|--------|---------------|
| Input sort | Not required | Not required |
| Master key pos | 21-28 | 21-28 (same) |
| Trans key pos | 13-20 | 13-20 (same) |
| Dup tracking | No | Yes (both sides) |
| Trans dup table | No | Yes |

## Assignment 4 Extension: VALIDATE_COUNT.cbl

### Purpose
Compare input and output record counts after SORT.

### Pattern (similar to CNTCHECK)
```cobol
SELECT IN-FILE  ASSIGN TO INFILE
    ORGANIZATION IS SEQUENTIAL
    FILE STATUS IS FS-IN.
SELECT OUT-FILE ASSIGN TO OUTFILE
    ORGANIZATION IS SEQUENTIAL
    FILE STATUS IS FS-OUT.

COUNTING:
    PERFORM UNTIL IN-DONE
       READ IN-FILE
       IF FS-IN = '00' ADD 1 TO IN-COUNT
    END-PERFORM.
    
    PERFORM UNTIL OUT-DONE
       READ OUT-FILE
       IF FS-OUT = '00' ADD 1 TO OUT-COUNT
    END-PERFORM.

COMPARISON:
    IF IN-COUNT = OUT-COUNT
       MOVE 0 TO RETURN-CODE
    ELSE
       MOVE 12 TO RETURN-CODE.
```

## VSAM COBOL Patterns (VSAMLOOK.cbl)

### KSDS Definition
```cobol
SELECT EMPLOYEE-FILE ASSIGN TO EMPKSDS
    ORGANIZATION IS INDEXED
    ACCESS MODE IS DYNAMIC
    RECORD KEY IS EMPLOYEE-KEY
    FILE STATUS IS FS-EMP.
```

### Dynamic Access (Keyed + Sequential)
```cobol
/* Random read by key */
MOVE SEARCH-KEY TO EMPLOYEE-KEY
READ EMPLOYEE-FILE KEY IS EMPLOYEE-KEY
  INVALID KEY
    IF FS-EMP = '23'  /* Record not found */
    ...
  END-READ.

/* Sequential read */
READ EMPLOYEE-FILE NEXT
```

### GnuCOBOL INDEXED (NOT VSAM)
```cobol
/* Local testing only - creates .idx/.dat files */
SELECT FILE ASSIGN TO "filename"
    ORGANIZATION IS INDEXED
    ACCESS MODE IS DYNAMIC
    RECORD KEY IS KEY-FIELD.
```
- **Label all local INDEXED tests**: "GnuCOBOL INDEXED - NOT VSAM"

## Missing COBOL Examples (Added)

### REWRITE (Update KSDS)
```cobol
READ EMPLOYEE-FILE KEY IS EMP-KEY
  INVALID KEY DISPLAY 'NOT FOUND' END-READ.
MOVE NEW-DATA TO EMP-REC.
REWRITE EMP-REC
  INVALID KEY DISPLAY 'REWRITE ERROR' END-REWRITE.
```

### DELETE (Remove from KSDS)
```cobol
READ EMPLOYEE-FILE KEY IS EMP-KEY
  INVALID KEY DISPLAY 'NOT FOUND' END-READ.
DELETE EMPLOYEE-FILE
  INVALID KEY DISPLAY 'DELETE ERROR' END-DELETE.
```

### START (Position for Sequential)
```cobol
MOVE LOW-VALUE TO EMPLOYEE-KEY
START EMPLOYEE-FILE KEY IS GREATER THAN EMPLOYEE-KEY
  INVALID KEY DISPLAY 'START ERROR' END-START.
READ EMPLOYEE-FILE NEXT
```

### Alternate Index (AIX)
```cobol
SELECT EMPLOYEE-FILE ASSIGN TO EMPKSDS
    ORGANIZATION IS INDEXED
    ACCESS MODE IS DYNAMIC
    RECORD KEY IS EMPLOYEE-KEY
    ALTERNATE RECORD KEY IS EMP-NAME WITH DUPLICATES
    FILE STATUS IS FS-EMP.

/* Read by alternate key */
MOVE SEARCH-NAME TO EMP-NAME
READ EMPLOYEE-FILE KEY IS EMP-NAME
  INVALID KEY ...
```

## Record Layouts

### 80-Byte Transaction (EXPENSE-REC.cpy)
| Bytes | Field | PIC |
|-------|-------|-----|
| 1-12 | TXN-ID | X(12) |
| 13-20 | EMP-ID | X(08) |
| 21-28 | DATE | X(08) YYYYMMDD |
| 29-32 | CATEGORY | X(04) |
| 33-41 | AMOUNT-CENTS | X(09) / 9(09) |
| 42-80 | DESCRIPTION | X(39) |

### 100-Byte Extended (EXPENSE-EXT-REC.cpy)
| Bytes | Field | PIC |
|-------|-------|-----|
| 1-12 | TXN-ID | X(12) |
| 13-24 | COST-CENTRE | X(12) |
| 25-32 | EMP-ID (KEY) | X(08) |
| 33-40 | DATE | X(08) |
| 41-44 | CATEGORY | X(04) |
| 45-53 | AMOUNT-CENTS | X(09) |
| 54-100 | DESCRIPTION | X(47) |

### Employee Master (80-byte)
| Bytes | Field | PIC |
|-------|-------|-----|
| 1-20 | FILLER | X(20) |
| 21-28 | EMP-ID (KEY) | X(08) |
| 29-80 | FILLER | X(52) |

## Compilation (Local)
```bash
# GnuCOBOL
cobc -x -o bin/PROGRAM mainframe/PROGRAM.cbl

# With copybook path
cobc -x -I mainframe -o bin/PROGRAM mainframe/PROGRAM.cbl
```

## Testing (Local)
```bash
# Set DD env vars and run
DD_INFILE=input.dat DD_OUTFILE=output.dat ./bin/PROGRAM

# lib/cobol.js handles this automatically
```

## Best Practices
1. **Always check FILE STATUS** after every OPEN/READ/WRITE/CLOSE
2. **Use 88-levels** for boolean flags (cleaner than PIC X comparisons)
3. **Initialize all WORKING-STORAGE** (VALUE clauses)
4. **Close files in reverse order** of opening
5. **DISPLAY counts** for audit trail
6. **Return codes**: 0=OK, 4=Warning, 12=Error
7. **Fixed-form**: Column 7 for continuation (-) or comment (*)
8. **No tabs**: Use spaces only
9. **Line length**: Max 72 columns for code (cols 8-72)
10. **Avoid reserved words** as file names (see MATCH2.cbl note)