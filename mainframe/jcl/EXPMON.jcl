//EXPMON   JOB (ACCT),'EXPENSE RESULT MONITOR',CLASS=A,MSGCLASS=X,
//             NOTIFY=&SYSUID
//*
//* Controlled post-processing step for the project-owned EXPPOST results.
//* The REXX exec only reads RESULT and returns:
//*   RC 0  all records are POSTED
//*   RC 4  valid processing with one or more REJECTED records
//*   RC 12 malformed, unknown-status, missing, or unreadable output
//*
//MONITOR  EXEC PGM=IKJEFT01,DYNAMNBR=20
//SYSEXEC  DD DSN=&SYSUID..REXX,DISP=SHR
//SYSTSPRT DD SYSOUT=*
//SYSTSIN  DD *
  %EXPMON 'Z86073.EXPTRK.RESULT'
/*
