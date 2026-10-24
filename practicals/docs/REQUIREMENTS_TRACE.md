# Requirements Traceability Matrix

Maps PDF requirements to implementation files and verification status.

| PDF Requirement | Project File(s) | Status | Verification Method | Notes |
|-----------------|-----------------|--------|---------------------|-------|
| **Assignment 1: JCL SORT Dedupe + Key Sort** | | | | |
| Exact full-record duplicate removal (SUM FIELDS=NONE) | `practicals/JCL/ASSIGN1_SORT_DEDUP.jcl` (CLEANA step) | Z/OS-READY, NOT EXECUTED | JCL control card review; SIMULATED validator `practicals/TESTS/validate-assign1.js` | Variant A: SORT FIELDS=(13,8,CH,A,1,80,CH,A) + SUM FIELDS=NONE |
| Duplicate KEY only removal (cols 13-20) | `practicals/JCL/ASSIGN1_SORT_DEDUP.jcl` (CLEANB step) | Z/OS-READY, NOT EXECUTED | JCL control card review; SIMULATED validator `practicals/TESTS/validate-assign1.js` | Variant B: SORT FIELDS=(13,8,CH,A),EQUALS + SUM FIELDS=NONE; keeps first record per key |
| ICETOOL COUNT validation | `practicals/JCL/ASSIGN1_SORT_DEDUP.jcl` (COUNTA, COUNTB steps) | Z/OS-READY, NOT EXECUTED | JCL control card review | COUNT FROM(IN) EMPTY RC4 |
| Output DCB: RECFM=FB, LRECL=80, BLKSIZE=0 | `practicals/JCL/ASSIGN1_SORT_DEDUP.jcl` | Z/OS-READY, NOT EXECUTED | JCL DD statement review | Explicit in SORTOUT DD |
| Deterministic fixtures (90 unique + 10 exact dups) | `practicals/TESTDATA/fixture_a_100_records.txt` | EXECUTED | Node.js generator with fixed seed | Seed 123456789 |
| Deterministic fixtures (90 unique keys + 10 key dups) | `practicals/TESTDATA/fixture_b_100_records.txt` | EXECUTED | Node.js generator with fixed seed | Seed 987654321 |
| Local validator (SIMULATED) | `practicals/TESTS/validate-assign1.js` | EXECUTED | Node.js implements DFSORT logic | PASS |
| **Assignment 2: COBOL Match of Two PS Files** | | | | |
| FILE1: transactions, key cols 13-20 | `practicals/COBOL/ASSIGN2_MATCH.cbl` | EXECUTED | GnuCOBOL compile + run | F1-EMP-ID at cols 13-20 |
| FILE2: employee master, key cols 21-28 | `practicals/COBOL/ASSIGN2_MATCH.cbl` | EXECUTED | GnuCOBOL compile + run | F2-EMP-ID at cols 21-28 |
| In-memory table lookup (unsorted inputs) | `practicals/COBOL/ASSIGN2_MATCH.cbl` | EXECUTED | GnuCOBOL compile + run | MASTER-TABLE + TRANS-TABLE |
| Duplicate key handling on both sides | `practicals/COBOL/ASSIGN2_MATCH.cbl` | EXECUTED | GnuCOBOL compile + run | MASTER-DUP-CNT, TRANS-DUP-CNT |
| All FILE STATUS values handled | `practicals/COBOL/ASSIGN2_MATCH.cbl` | EXECUTED | GnuCOBOL compile + run | EVALUATE on FS-F1, FS-F2, FS-F3, FS-F4 |
| DISPLAY read/matched/written/unmatched counts | `practicals/COBOL/ASSIGN2_MATCH.cbl` | EXECUTED | GnuCOBOL compile + run | 6 DISPLAY statements |
| RC 0 / 4 (unmatched) / 12 (file error) | `practicals/COBOL/ASSIGN2_MATCH.cbl` | EXECUTED | GnuCOBOL compile + run | Verified with test fixtures |
| Fixtures: 50 + 50 records, 35 matched | `practicals/TESTDATA/assign2_trans50.txt`, `assign2_master50.txt` | EXECUTED | Node.js generator | Fixed seeds |
| Local validator (SIMULATED) | `practicals/TESTS/validate-assign2.js` | EXECUTED | Node.js implements same logic | PASS |
| JCL for COBOL match | `practicals/JCL/ASSIGN2_MATCH.jcl` | Z/OS-READY, NOT EXECUTED | JCL review | DD names = ASSIGN TO names |
| **Assignment 3: REXX Dedupe + Sort (100-byte)** | | | | |
| 100-byte records per EXPENSE-EXT-REC.cpy | `practicals/REXX/ASSIGN3_DEDUP_SORT.rexx` | Z/OS-READY, NOT EXECUTED | REXX source review | inLrecl=100, keyStart=25, keyLen=8 |
| Exact full-record de-duplication | `practicals/REXX/ASSIGN3_DEDUP_SORT.rexx` | Z/OS-READY, NOT EXECUTED | REXX source review | seen. stem with full record key |
| Merge sort O(n log n) by key | `practicals/REXX/ASSIGN3_DEDUP_SORT.rexx` | Z/OS-READY, NOT EXECUTED | REXX source review | Iterative bottom-up merge sort |
| Parameters at top: record length, key position | `practicals/REXX/ASSIGN3_DEDUP_SORT.rexx` | Z/OS-READY, NOT EXECUTED | REXX source review | inLrecl, outLrecl, keyStart, keyLen |
| TSO/E dataset I/O separate from USS | `practicals/REXX/ASSIGN3_DEDUP_SORT.rexx` | Z/OS-READY, NOT EXECUTED | REXX source review | ALLOC/EXECIO for TSO; commented for USS |
| Reports: read/duplicates removed/written | `practicals/REXX/ASSIGN3_DEDUP_SORT.rexx` | Z/OS-READY, NOT EXECUTED | REXX source review | 3 SAY statements |
| Exit non-zero unless exactly 105 | `practicals/REXX/ASSIGN3_DEDUP_SORT.rexx` | Z/OS-READY, NOT EXECUTED | REXX source review | expectedOut=105, exit 8 on mismatch |
| Fixture: 105 unique + 15 exact dups | `practicals/TESTDATA/fixture_c_120_records.txt` | EXECUTED | Node.js generator | Seed 555555555 |
| Fixture D: key-dup vs full-dup difference | `practicals/TESTDATA/fixture_d_key_vs_full_dup.txt` | EXECUTED | Node.js generator | 8 full-record, 6 key-only |
| Local validator (SIMULATED) | `practicals/TESTS/validate-assign3.js` | EXECUTED | Node.js implements same algorithm | PASS |
| JCL for REXX via IKJEFT01 | `practicals/JCL/ASSIGN3_RUN.jcl` | Z/OS-READY, NOT EXECUTED | JCL review | SYSTSIN EXEC 'ASSIGN3_DEDUP_SORT' |
| **Assignment 4: Copy/Sort Descending + Conditional Keep** | | | | |
| Count input records (ICETOOL) | `practicals/JCL/ASSIGN4_SORT_VALIDATE.jcl` (COUNTIN) | Z/OS-READY, NOT EXECUTED | JCL review | COUNT FROM(IN) EMPTY RC4 |
| SORT descending by amount (cols 33-41) to &&TEMP | `practicals/JCL/ASSIGN4_SORT_VALIDATE.jcl` (SORTD) | Z/OS-READY, NOT EXECUTED | JCL review | SORT FIELDS=(33,9,CH,D) |
| Count output records (ICETOOL) | `practicals/JCL/ASSIGN4_SORT_VALIDATE.jcl` (COUNTOUT) | Z/OS-READY, NOT EXECUTED | JCL review | COUNT FROM(OUT) EMPTY RC4 |
| COBOL VALIDATE_COUNT compares counts | `practicals/COBOL/VALIDATE_COUNT.cbl` | EXECUTED | GnuCOBOL compile + run | RC 0 match / 12 mismatch |
| IF/THEN/ELSE: RC=0 copy temp to final | `practicals/JCL/ASSIGN4_SORT_VALIDATE.jcl` | Z/OS-READY, NOT EXECUTED | JCL review | IF (VALID.RC = 0) THEN COPYOK ELSE DIAGFAIL |
| On failure: no final dataset, diagnostic, RC=12 | `practicals/JCL/ASSIGN4_SORT_VALIDATE.jcl` | Z/OS-READY, NOT EXECUTED | JCL review | DELTEMP + SET MAXCC=12 |
| COND= variant shown | `practicals/JCL/ASSIGN4_SORT_VALIDATE.jcl` | Z/OS-READY, NOT EXECUTED | JCL review | Commented alternative |
| PS vs PDS-member input documented | `practicals/JCL/ASSIGN4_SORT_VALIDATE.jcl` | Z/OS-READY, NOT EXECUTED | JCL comment | DSN=HLQ.LIB(MEMBER) for PDS |
| Fixtures: SUCCESS (20=20) and FAILURE (20!=19) | `practicals/TESTDATA/assign4_valid_input.txt`, `assign4_truncated_output.txt` | EXECUTED | Node.js generator | |
| Local validator (SIMULATED) | `practicals/TESTS/validate-assign4.js` | EXECUTED | Node.js mimics JCL logic | PASS |
| **VSAM Extensions** | | | | |
| KSDS Employee Master (KEYS 8 20, FREESPACE, SHAREOPTIONS) | `practicals/JCL/VSAM/VSAM-DEFINE.jcl` (DEFINEKS) | Z/OS-READY, NOT EXECUTED | JCL review | Non-destructive DEFINE |
| ESDS Audit Log (NONINDEXED, sequential append) | `practicals/JCL/VSAM/VSAM-DEFINE.jcl` (DEFINESD) | Z/OS-READY, NOT EXECUTED | JCL review | RBA addressing |
| RRDS Batch Control (NUMBERED, relative record) | `practicals/JCL/VSAM/VSAM-DEFINE.jcl` (DEFINERD) | Z/OS-READY, NOT EXECUTED | JCL review | RRN = batch sequence |
| LDS concept note | `practicals/JCL/VSAM/VSAM-DEFINE.jcl` | Z/OS-READY, NOT EXECUTED | JCL comment | Not for COBOL records |
| VSAM MATCH JCL | `practicals/JCL/VSAM/VSAM-MATCH.jcl` | Z/OS-READY, NOT EXECUTED | JCL review | DYNAMIC access, keyed READ |
| VSAMLOOK COBOL (read by key, update, delete) | `practicals/JCL/VSAM/VSAMLOOK.cbl` | EXECUTED (GnuCOBOL) | GnuCObol INDEXED | NOT VSAM - GnuCOBOL indexed |
| Backup/restore REPRO/EXPORT/IMPORT | `practicals/JCL/VSAM/VSAM-DEFINE.jcl` comments | Z/OS-READY, NOT EXECUTED | JCL review | IDCAMS commands documented |
| CI/CA, splits, free space, index/data components | `docs/VSAM_GUIDE.md` | DOCUMENTED | Documentation | Explained in guide |
| **Concept Library** | | | | |
| JCL: IEFBR14, IEBGENER, IEBCOPY, PS/PDS/PDSE, FB/VB | `practicals/docs/JCL_GUIDE.md` | DOCUMENTED | Documentation | Compact examples |
| JCL: LRECL/BLKSIZE/SPACE/UNIT/VOL/DSN/DISP | `practicals/docs/JCL_GUIDE.md` | DOCUMENTED | Documentation | |
| JCL: && temp, GDG, SET, symbolic params, PROCs | `practicals/docs/JCL_GUIDE.md` | DOCUMENTED | Documentation | |
| JCL: COND vs IF/THEN/ELSE, DD * vs DD DATA | `practicals/docs/JCL_GUIDE.md` | DOCUMENTED | Documentation | |
| JCL: RESTART=, common abends (S0C7, S806, S913, IEC030I) | `practicals/docs/JCL_GUIDE.md` | DOCUMENTED | Documentation | |
| COBOL: validation, totals, break processing, FILE STATUS | `practicals/docs/COBOL_GUIDE.md` | DOCUMENTED | Documentation | Existing programs cover |
| COBOL: REWRITE/DELETE example | `practicals/docs/COBOL_GUIDE.md` | DOCUMENTED | Documentation | Added |
| REXX: stems, PARSE, SELECT, ADDRESS TSO, EXECIO | `practicals/docs/REXX_GUIDE.md` | DOCUMENTED | Documentation | |
| REXX: RC handling, TRACE, TSO/batch execution | `practicals/docs/REXX_GUIDE.md` | DOCUMENTED | Documentation | |
| Dataset concepts | `practicals/docs/DATASET_CONCEPTS.md` | DOCUMENTED | Documentation | |
| Execution guide (Zowe, IBM Z Xplore) | `practicals/docs/EXECUTION_GUIDE.md` | DOCUMENTED | Documentation | |
| Troubleshooting | `practicals/docs/TROUBLESHOOTING.md` | DOCUMENTED | Documentation | |
| **Layout & Tests** | | | | |
| practicals/ directory structure | `practicals/` | EXISTING | File system | All subdirs present |
| REQUIREMENTS_TRACE.md | `practicals/docs/REQUIREMENTS_TRACE.md` | THIS FILE | Documentation | |
| Test runner run-all.js | `practicals/TESTS/run-all.js` | EXECUTED | Node.js script | Runs all validators |
| package.json test:practicals script | `package.json` | EXECUTED | npm script | Added |
| Existing npm test unaffected | `npm test` | EXECUTED | Full test suite | PASS |