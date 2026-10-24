//ASSIGN4  JOB (ACCT),'ASSIGN4 SORT VALIDATE',CLASS=A,MSGCLASS=X,
//             NOTIFY=&SYSUID
//* ================================================================
//* ASSIGNMENT 4: COPY/SORT DESCENDING + CONDITIONAL KEEP
//* Input:  EXPENSE.VALID (80-byte, validated transactions)
//* Sort:   Descending by amount (cols 33-41, 9 bytes)
//* Temp:   &&TEMPSORT (temporary dataset)
//* Validate: VALIDATE_COUNT compares input/output counts
//* IF/THEN/ELSE: On RC=0 copy temp to final; else delete temp, print diag
//* Also shows COND= variant
//* ================================================================
//* PS INPUT (default): DSN=&SYSUID..EXPENSE.VALID
//* PDS INPUT example:  DSN=&SYSUID..LIB(VALIDDATA)
//* ================================================================
//*
//* STEP 1: Count input records
//COUNTIN  EXEC PGM=ICETOOL
//TOOLMSG  DD SYSOUT=*
//DFSMSG   DD SYSOUT=*
//IN       DD DSN=&SYSUID..EXPENSE.VALID,DISP=SHR
//TOOLIN   DD *
  COUNT FROM(IN) EMPTY RC4
/*
//*
//* STEP 2: Sort descending by amount (cols 33-41) into temporary dataset
//SORTD    EXEC PGM=SORT
//SYSOUT   DD SYSOUT=*
//SORTIN   DD DSN=&SYSUID..EXPENSE.VALID,DISP=SHR
//SORTOUT  DD DSN=&&TEMPSORT,
//            DISP=(NEW,PASS),UNIT=SYSDA,
//            SPACE=(TRK,(5,5),RLSE),
//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)
//SYSIN    DD *
  SORT FIELDS=(33,9,CH,D)
/*
//*
//* STEP 3: Count output records
//COUNTOUT EXEC PGM=ICETOOL
//TOOLMSG  DD SYSOUT=*
//DFSMSG   DD SYSOUT=*
//OUT      DD DSN=&&TEMPSORT,DISP=SHR
//TOOLIN   DD *
  COUNT FROM(OUT) EMPTY RC4
/*
//*
//* STEP 4: COBOL validation - compare counts
//VALID    EXEC PGM=VALIDCNT,COND=(0,NE,SORTD)
//STEPLIB  DD DSN=&SYSUID..LOADLIB,DISP=SHR
//INFILE   DD DSN=&SYSUID..EXPENSE.VALID,DISP=SHR
//OUTFILE  DD DSN=&&TEMPSORT,DISP=SHR
//SYSOUT   DD SYSOUT=*
//*
//* ================================================================
//* IF/THEN/ELSE: On RC=0 copy temp to final catalogued dataset
//*               On RC!=0 delete temp, print diagnostic, fail
//* ================================================================
// IF (VALID.RC = 0) THEN
//COPYOK   EXEC PGM=IEBCOPY
//SYSPRINT DD SYSOUT=*
//SYSUT1   DD DSN=&&TEMPSORT,DISP=(OLD,DELETE)
//SYSUT2   DD DSN=&SYSUID..EXPENSE.REPORT,
//            DISP=(NEW,CATLG,DELETE),UNIT=SYSDA,
//            SPACE=(TRK,(5,5),RLSE),
//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)
//SYSIN    DD *
  COPY INDD=SYSUT1,OUTDD=SYSUT2
/*
// ELSE
//DIAGFAIL EXEC PGM=IEBGENER
//SYSPRINT DD SYSOUT=*
//SYSUT1   DD *
VALIDATION FAILED: Input count != Output count
SORT output not catalogued. Temporary dataset &&TEMPSORT deleted.
/*
//SYSUT2   DD SYSOUT=*
//SYSIN    DD DUMMY
//DELTEMP  EXEC PGM=IEFBR14
//TEMP     DD DSN=&&TEMPSORT,DISP=(OLD,DELETE)
//SETFAIL  EXEC PGM=IDCAMS
//SYSPRINT DD SYSOUT=*
//SYSIN    DD *
  SET MAXCC=12
/*
// ENDIF
//*
//* ================================================================
//* COND= VARIANT (alternative to IF/THEN/ELSE)
//* Uncomment below and comment IF/THEN/ELSE above to use COND=
//* ================================================================
//* COPYOK   EXEC PGM=IEBCOPY,COND=(0,EQ,VALID)
//* SYSPRINT DD SYSOUT=*
//* SYSUT1   DD DSN=&&TEMPSORT,DISP=(OLD,DELETE)
//* SYSUT2   DD DSN=&SYSUID..EXPENSE.REPORT,
//*             DISP=(NEW,CATLG,DELETE),UNIT=SYSDA,
//*             SPACE=(TRK,(5,5),RLSE),
//*             DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)
//* SYSIN    DD *
//*   COPY INDD=SYSUT1,OUTDD=SYSUT2
//* /*
//* DIAGFAIL EXEC PGM=IEBGENER,COND=(0,NE,VALID)
//* SYSPRINT DD SYSOUT=*
//* SYSUT1   DD *
//* VALIDATION FAILED: Input count != Output count
//* /*
//* SYSUT2   DD SYSOUT=*
//* SYSIN    DD DUMMY
//* DELTEMP  EXEC PGM=IEFBR14,COND=(0,NE,VALID)
//* TEMP     DD DSN=&&TEMPSORT,DISP=(OLD,DELETE)
//* SETFAIL  EXEC PGM=IDCAMS,COND=(0,NE,VALID)
//* SYSPRINT DD SYSOUT=*
//* SYSIN    DD *
//*   SET MAXCC=12
//* /*
//* ================================================================
//* LOCAL TEST (SIMULATED):
//* Build: cobc -x -o practicals/bin/VALIDCNT practicals/COBOL/VALIDATE_COUNT.cbl
//* Fixtures: practicals/TESTDATA/assign4_valid_input.txt (80-byte)
//* Run: node practicals/TESTS/validate-assign4.js
//* ================================================================