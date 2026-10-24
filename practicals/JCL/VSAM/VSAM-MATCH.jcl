//VSAMMAT  JOB (ACCT),'EXPENSE VSAM KSDS MATCH',CLASS=A,MSGCLASS=X,
//             NOTIFY=&SYSUID
//* ================================================================
//* VSAM KSDS MATCH: Transaction validation against Employee Master KSDS
//* Requires: KSDS defined and loaded via VSAM-DEFINE.jcl
//* COBOL: VSAMLOOK.cbl compiled with IBM Enterprise COBOL
//* ================================================================
//SET HLQ=&SYSUID
//*
//MATCH    EXEC PGM=VSAMLOOK
//STEPLIB  DD DSN=&HLQ..LOADLIB,DISP=SHR
//TRANSIN  DD DSN=&HLQ..EXPENSE.CLEAN,DISP=SHR
//EMPKSDS  DD DSN=&HLQ..EXPENSE.MASTER,DISP=SHR
//MATCHOUT DD DSN=&HLQ..EXPENSE.MATCHED,
//            DISP=(NEW,CATLG,DELETE),UNIT=SYSDA,
//            SPACE=(TRK,(5,5),RLSE),
//            DCB=(RECFM=FB,LRECL=80,BLKSIZE=0)
//REJOUT   DD DSN=&HLQ..EXPENSE.UNKNOWN,
//            DISP=(NEW,CATLG,DELETE),UNIT=SYSDA,
//            SPACE=(TRK,(2,2),RLSE),
//            DCB=(RECFM=FB,LRECL=110,BLKSIZE=0)
//SYSOUT   DD SYSOUT=*
//* ================================================================
//* COBOL FILE-CONTROL for KSDS:
//*    SELECT EMPLOYEE-FILE ASSIGN TO EMPKSDS
//*        ORGANIZATION IS INDEXED
//*        ACCESS MODE IS DYNAMIC
//*        RECORD KEY IS EMPLOYEE-KEY
//*        FILE STATUS IS FS-EMP.
//* ================================================================