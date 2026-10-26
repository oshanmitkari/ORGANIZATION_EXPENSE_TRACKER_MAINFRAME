//CODXCOMP JOB (ACCT),'VERIFY IGYWCL',CLASS=A,MSGCLASS=X,NOTIFY=&SYSUID
//* Compile-only probe. Reads existing reference source; creates a new
//* member
//* CODXTEST in the existing load library if compilation and link-edit
//* succeed.
//* It does not run a program, access VSAM, or alter any existing
//* member.
//COBRUN   EXEC IGYWCL
//COBOL.SYSIN   DD DSN=Z86073.CBL(CBLJSON),DISP=SHR
//LKED.SYSLMOD  DD DSN=Z86073.LOAD(CODXTEST),DISP=SHR
//LKED.SYSPRINT DD SYSOUT=*
