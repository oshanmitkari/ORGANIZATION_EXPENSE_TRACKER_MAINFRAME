//ASSIGN3  JOB (ACCT),'ASSIGN3 REXX DEDUP SORT',CLASS=A,MSGCLASS=X,
//             NOTIFY=&SYSUID
//* ================================================================
//* ASSIGNMENT 3: REXX DEDUPE + SORT (100-BYTE RECORDS)
//* Input:  120 x 100-byte records (105 unique + 15 exact duplicates)
//* Key:    columns 25-32 (EXT-EMP-ID per EXPENSE-EXT-REC.cpy)
//* Output: 105 unique records, sorted ascending by key
//* Method: Exact de-duplication (full 100-byte) + merge sort O(n log n)
//* Exit:   RC=0 if 105 records, RC=8 if count mismatch, RC=12 on error
//* ================================================================
//* TSO/E REXX execution via IKJEFT01
//* ================================================================
//REXX     EXEC PGM=IKJEFT01
//SYSTSPRT DD SYSOUT=*
//SYSTSIN  DD *
  EXEC 'ASSIGN3_DEDUP_SORT'
/*
//SYSEXEC  DD DSN=&SYSUID..REXX.LIB,DISP=SHR
//* Input/Output datasets (REXX EXECIO uses DD names IN and OUT)
//IN       DD DSN=&SYSUID..EXPENSE.TRANS100,DISP=SHR
//OUT      DD DSN=&SYSUID..EXPENSE.CLEAN100,
//            DISP=(NEW,CATLG,DELETE),UNIT=SYSDA,
//            SPACE=(TRK,(5,5),RLSE),
//            DCB=(RECFM=FB,LRECL=100,BLKSIZE=0)
//* ================================================================
//* LOCAL TEST (SIMULATED):
//* Node.js reference implementing same algorithm
//* Fixtures: practicals/TESTDATA/fixture_c_120_records.txt (120 x 100-byte)
//* Run: node practicals/TESTS/validate-assign3.js
//* Real REXX exec is Z/OS-READY, NOT EXECUTED locally
//* ================================================================