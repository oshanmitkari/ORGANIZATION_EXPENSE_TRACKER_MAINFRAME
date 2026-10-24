//ASSIGN1  JOB (ACCT),'ASSIGN1 SORT DEDUPE',CLASS=A,MSGCLASS=X,
//             NOTIFY=&SYSUID
//* ================================================================
//* ASSIGNMENT 1: JCL SORT DEDUPE + KEY SORT
//* Two documented variants:
//*   (a) Exact full-record duplicates removed (SUM FIELDS=NONE)
//*   (b) Duplicate KEY only removed (cols 13-20)
//* Both yield 90 records from 100-record input with 10 duplicates
//* Output DCB: RECFM=FB, LRECL=80, BLKSIZE=0
//* Includes ICETOOL COUNT validation step
//* ================================================================
//*
//* INPUT:  &SYSUID..EXPENSE.TRANS.IN (100 records, 80 bytes)
//* OUTPUT: &SYSUID..EXPENSE.CLEAN.VARA (Variant A)
//*         &SYSUID..EXPENSE.CLEAN.VARB (Variant B)
//* ================================================================
//*
//* VARIANT A: Exact full-record duplicate removal
//* SORT FIELDS=(13,8,CH,A,1,80,CH,A) + SUM FIELDS=NONE
//* - First sorts by employee key (cols 13-20) then full record
//* - SUM FIELDS=NONE eliminates records where ALL 80 bytes match
//* - Kept record: first encountered after sort (deterministic)
//* ================================================================
//CLEANA   EXEC PGM=SORT
//SYSOUT   DD SYSOUT=*
//SORTIN   DD DSN=&SYSUID..EXPENSE.TRANS.IN,DISP=SHR
//SORTOUT  DD DSN=&SYSUID..EXPENSE.CLEAN.VARA,
//            DISP=(NEW,CATLG,DELETE),UNIT=SYSDA,
//            SPACE=(TRK,(5,5),RLSE),
//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)
//SYSIN    DD *
  SORT FIELDS=(13,8,CH,A,1,80,CH,A)
  SUM FIELDS=NONE
/*
//* ICETOOL count validation for Variant A
//COUNTA   EXEC PGM=ICETOOL
//TOOLMSG  DD SYSOUT=*
//DFSMSG   DD SYSOUT=*
//INA      DD DSN=&SYSUID..EXPENSE.CLEAN.VARA,DISP=SHR
//TOOLIN   DD *
  COUNT FROM(INA) EMPTY RC4
/*
//*
//* VARIANT B: Duplicate KEY only removal (cols 13-20)
//* SORT FIELDS=(13,8,CH,A) + SUM FIELDS=NONE
//* - Sorts only by employee key (cols 13-20, 8 bytes)
//* - SUM FIELDS=NONE eliminates records where KEY matches
//* - Kept record: FIRST record for each key after sort
//*   (Use EQUALS to preserve original input order for ties)
//* ================================================================
//CLEANB   EXEC PGM=SORT
//SYSOUT   DD SYSOUT=*
//SORTIN   DD DSN=&SYSUID..EXPENSE.TRANS.IN,DISP=SHR
//SORTOUT  DD DSN=&SYSUID..EXPENSE.CLEAN.VARB,
//            DISP=(NEW,CATLG,DELETE),UNIT=SYSDA,
//            SPACE=(TRK,(5,5),RLSE),
//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)
//SYSIN    DD *
  SORT FIELDS=(13,8,CH,A),EQUALS
  SUM FIELDS=NONE
/*
//* ICETOOL count validation for Variant B
//COUNTB   EXEC PGM=ICETOOL
//TOOLMSG  DD SYSOUT=*
//DFSMSG   DD SYSOUT=*
//INB      DD DSN=&SYSUID..EXPENSE.CLEAN.VARB,DISP=SHR
//TOOLIN   DD *
  COUNT FROM(INB) EMPTY RC4
/*
//* ================================================================
//* LOCAL VALIDATOR (SIMULATED)
//* Node.js reference implementing same SORT rules
//* Compares against committed expected-output files
//* Run: node practicals/TESTS/validate-assign1.js
//* ================================================================