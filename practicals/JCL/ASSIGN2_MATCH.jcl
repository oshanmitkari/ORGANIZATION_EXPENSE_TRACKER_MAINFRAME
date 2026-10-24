//ASSIGN2  JOB (ACCT),'ASSIGN2 COBOL MATCH',CLASS=A,MSGCLASS=X,
 //             NOTIFY=&SYSUID
 //* ================================================================
 //* ASSIGNMENT 2: COBOL MATCH OF TWO PS FILES
 //* FILE1 = transactions (50 records), key at cols 13-20 (emp ID)
 //* FILE2 = employee master  (50 records), key at cols 21-28 (emp ID)
 //* FILE3 = matched FILE1 records (output)
 //* FILE4 = unmatched FILE1 records with reason (110 bytes)
 //* In-memory table lookup (not guaranteed sorted)
 //* RC 0 = all matched, 4 = unmatched found, 12 = file error
 //* ================================================================
 //* Compile with: cobc -x -o practicals/bin/ASSIGN2MT practicals/COBOL/ASSIGN2_MATCH.cbl
 //* Run with: DD_FILE1=... DD_FILE2=... DD_FILE3=... DD_FILE4=... practicals/bin/ASSIGN2MT
 //* ================================================================
 //COMP     EXEC PGM=COBC,PARM='-x -o ASSIGN2MT practicals/COBOL/ASSIGN2_MATCH.cbl'
 //STEPLIB  DD DSN=&SYSUID..LOADLIB,DISP=SHR
 //SYSOUT   DD SYSOUT=*
 //SYSPRINT DD SYSOUT=*
 //SYSIN    DD DUMMY
 //*
 //MATCH    EXEC PGM=ASSIGN2MT
 //STEPLIB  DD DSN=&SYSUID..LOADLIB,DISP=SHR
 //SYSOUT   DD SYSOUT=*
 //FILE1    DD DSN=&SYSUID..EXPENSE.TRANS50,DISP=SHR
 //FILE2    DD DSN=&SYSUID..EMPLOYEE.MASTER50,DISP=SHR
 //FILE3    DD DSN=&SYSUID..EXPENSE.MATCHED,
 //            DISP=(NEW,CATLG,DELETE),UNIT=SYSDA,
 //            SPACE=(TRK,(5,5),RLSE),
 //            DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)
 //FILE4    DD DSN=&SYSUID..EXPENSE.UNMATCHED,
 //            DISP=(NEW,CATLG,DELETE),UNIT=SYSDA,
 //            SPACE=(TRK,(2,2),RLSE),
 //            DCB=(RECFM=FB,LRECL=110,BLKSIZE=0)
 //* ================================================================
 //* LOCAL TEST (SIMULATED):
 //* Build: mkdir -p practicals/bin && cobc -x -o practicals/bin/ASSIGN2MT practicals/COBOL/ASSIGN2_MATCH.cbl
 //* Fixtures: practicals/TESTDATA/assign2_trans50.txt (50 trans)
 //*           practicals/TESTDATA/assign2_master50.txt (50 master)
 //* Run: DD_FILE1=practicals/TESTDATA/assign2_trans50.txt \
 //*      DD_FILE2=practicals/TESTDATA/assign2_master50.txt \
 //*      DD_FILE3=practicals/TESTDATA/assign2_matched_out.txt \
 //*      DD_FILE4=practicals/TESTDATA/assign2_unmatched_out.txt \
 //*      practicals/bin/ASSIGN2MT
 //* Validate: node practicals/TESTS/validate-assign2.js
 //* ================================================================