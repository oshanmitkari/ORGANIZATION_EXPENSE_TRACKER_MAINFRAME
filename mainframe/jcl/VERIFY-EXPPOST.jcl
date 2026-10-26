//EXPCCOMP JOB (ACCT),'VERIFY EXPPOST',CLASS=A,MSGCLASS=X
//* Compile-only project probe. No RUN step and no VSAM DD statements.
//* Source and copybook are uploaded only to previously absent members.
//COBRUN   EXEC IGYWCL,SRC=EXPPOST
//COBOL.SYSLIB DD DSN=Z86073.SOURCE,DISP=SHR
