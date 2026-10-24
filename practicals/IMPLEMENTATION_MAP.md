# Implementation Map: Mainframe Concepts Integration

## Existing Application Overview

**Business Domain**: Corporate Expense Management
- Employee expense submission, approval workflow, finance posting
- Role-based access: EMPLOYEE, MANAGER, FINANCE_OPERATOR, FINANCE_ADMIN, AUDITOR
- 80-byte fixed-width transaction records (EXPENSE-REC.cpy)
- Employee master data (EMPLOYEE.MASTER)
- Batch pipeline: EXPDEDUP → MATCH2 → EXPVALID → EXPTOTAL → EXPRPT → CNTCHECK

## PDF Concepts → Existing Workflow Mapping

| PDF Concept | Existing Workflow | Integration Approach |
|-------------|-------------------|----------------------|
| **Assignment 1: JCL SORT dedupe + key sort** | EXPDEDUP.cbl (COBOL sort) + EXPCLEAN.jcl (DFSORT) | Enhance JCL with two dedupe variants (full-record vs key-only); add ICETOOL count validation; create deterministic test fixtures |
| **Assignment 2: COBOL match of two PS files** | MATCH2.cbl (matches transactions to employee master) | Extend MATCH2 with in-memory table lookup option; document duplicate key handling; add comprehensive FILE STATUS handling |
| **Assignment 3: REXX dedupe + sort (100-byte)** | DEDUPSRT.rexx (80-byte exact dedupe + shell sort) | Extend to 100-byte records (EXPENSE-EXT-REC.cpy); implement merge/heap sort; parameterize record length and key position |
| **Assignment 4: Copy/sort descending + conditional keep** | RPTCHECK.jcl + CNTCHECK.cbl (sort by amount, validate counts) | Fix RPTCHECK gap (catalogs before validating); use temporary dataset (&&); implement IF/THEN/ELSE and COND= variants |

## VSAM Integration

| VSAM Type | Business Entity | Access Pattern | Implementation |
|-----------|-----------------|----------------|----------------|
| KSDS | Employee Master | Keyed lookup by employee ID (cols 21-28) | Extend VSAM-DEFINE.jcl, VSAMLOOK.cbl |
| ESDS | Audit Log (EXPENSE.AUDIT) | Sequential append, timestamp order | New IDCAMS define + COBOL write |
| RRDS | Batch Control Records | Relative record access by run ID | New IDCAMS define + COBOL read/write |
| LDS | Concept note only | Not for COBOL record processing | Documentation only |

## Architecture Integration Points

### 1. Enhanced Batch Pipeline (JCL Orchestration)
```
Daily Processing JCL:
  STEP1: INGEST - Validate 80-byte records, load to staging
  STEP2: SORT/DEDUPE - DFSORT exact dedupe + key sort (Assignment 1)
  STEP3: MATCH - COBOL match transactions to employee master (Assignment 2)
  STEP4: VALIDATE - COBOL validate amounts, dates, categories
  STEP5: TOTALS - COBOL category/monthly totals
  STEP6: REPORT - COBOL sort by amount desc + conditional keep (Assignment 4)
  STEP7: RECONCILE - CNTCHECK count validation
  STEP8: PUBLISH - Conditional: only if reconciliation passes
```

### 2. VSAM Dataset Design
```
KSDS: EMPLOYEE.MASTER.VSAM
  Key: Employee ID (8 bytes at offset 20)
  Record: 80 bytes (matches EMPLOYEE.MASTER layout)
  FREESPACE: 20% CI, 10% CA for inserts
  SHAREOPTIONS: 2 (cross-region read, exclusive write)

ESDS: EXPENSE.AUDIT.VSAM
  Sequential audit events
  Record: Variable (audit event data)
  Append-only, timestamp-ordered

RRDS: BATCH.CONTROL.VSAM
  Fixed 80-byte control records
  Relative record = batch run sequence
```

### 3. REXX Operational Automation
```
prepare_batch.rexx:
  - Allocate staging datasets
  - Validate input record counts and lengths
  - Generate JCL with symbolic parameters
  - Submit via TSO SUBMIT or batch

validate_results.rexx:
  - Check return codes from each step
  - Verify record counts match expectations
  - Generate operational summary report
  - Trigger alerts on failures

batch_operations.rexx:
  - Restart failed jobs from checkpoint
  - Archive processed datasets
  - Clean up temporary datasets
```

## Platform Compatibility

| Component | Local (GnuCOBOL/Node) | z/OS (IBM) |
|-----------|----------------------|------------|
| COBOL Programs | ✅ Compiled & tested | ✅ Source ready |
| JCL | ❌ Not executable | ✅ Ready for submission |
| DFSORT/ICETOOL | ❌ Not available | ✅ Native |
| REXX (TSO/E) | ❌ Not available | ✅ Native |
| VSAM (IDCAMS) | ❌ Not available | ✅ Native |
| GnuCOBOL INDEXED | ✅ Testable (not VSAM) | N/A |

## Test Strategy

### Local Tests (Executable)
- COBOL program parity with Node reference (existing cobol-test.js)
- Fixture generation with deterministic seeds
- Record layout validation (80/100 bytes)
- Return code verification (0/4/12)

### Simulated Tests (Algorithmic)
- DFSORT SORT FIELDS logic in Node
- REXX merge/heap sort algorithm in Node
- JCL conditional execution logic in Node

### z/OS-Ready (Not Executed)
- Full JCL job submission
- VSAM dataset operations
- TSO/E REXX execution
- IDCAMS define/load/verify

## Files to Create/Modify

### New Copybooks
- `mainframe/EXPENSE-EXT-REC.cpy` - 100-byte extended transaction record

### New COBOL Programs
- `mainframe/VALIDATE_COUNT.cbl` - Assignment 4 validation program
- Enhanced `mainframe/MATCH2.cbl` - In-memory table lookup option

### New JCL
- `mainframe/jcl/DAILY_PROCESS.jcl` - Complete daily batch pipeline
- `mainframe/jcl/ASSIGN1_SORT_DEDUP.jcl` - Two dedupe variants
- `mainframe/jcl/ASSIGN2_MATCH.jcl` - COBOL match job
- `mainframe/jcl/ASSIGN3_RUN.jcl` - REXX execution via IKJEFT01
- `mainframe/jcl/ASSIGN4_SORT_VALIDATE.jcl` - Conditional copy with temp dataset
- `mainframe/jcl/VSAM_DEFINE_ALL.jcl` - KSDS/ESDS/RRDS definitions

### New REXX
- `mainframe/rexx/prepare_batch.rexx`
- `mainframe/rexx/validate_results.rexx`
- `mainframe/rexx/batch_operations.rexx`
- Enhanced `mainframe/DEDUPSRT.rexx` → 100-byte version

### New Test Fixtures
- `data/test/fixture_a_100_records.txt` - 90 unique + 10 exact duplicates
- `data/test/fixture_b_100_records.txt` - 100 records, 10 key duplicates
- `data/test/fixture_c_120_records.txt` - 105 unique + 15 exact duplicates (100-byte)
- `data/test/fixture_d_key_vs_full_dup.txt` - Shows key-dup vs full-dup difference

### Documentation
- `practicals/docs/REQUIREMENTS_TRACE.md`
- `practicals/docs/DATASET_CONCEPTS.md`
- `practicals/docs/JCL_GUIDE.md`
- `practicals/docs/VSAM_GUIDE.md`
- `practicals/docs/REXX_GUIDE.md`
- `practicals/docs/EXECUTION_GUIDE.md`
- `practicals/docs/TROUBLESHOOTING.md`

### Test Runner
- `practicals/TESTS/run-all.js` - Executes all local/simulated tests
- Package.json script: `"test:practicals": "node practicals/TESTS/run-all.js"`

## Execution Status Labels

Every deliverable will be labeled:
- **EXECUTED** - Runs locally (GnuCOBOL/Node)
- **SIMULATED** - Algorithm tested locally, not native utility
- **Z/OS-READY, NOT EXECUTED** - Source ready, requires z/OS environment