//VSAMDEF  JOB (ACCT),'DEFINE EMPLOYEE KSDS + ESDS + RRDS',CLASS=A,MSGCLASS=X,
//             NOTIFY=&SYSUID
//* ================================================================
//* VSAM CLUSTER DEFINITIONS FOR EXPENSE TRACKER
//* HLQ configurable via //SET HLQ= (default &SYSUID.)
//* All DEFINE steps are non-destructive (fail if cluster exists)
//* ================================================================
//SET HLQ=&SYSUID
//*
//* ----------------------------------------------------------------
//* 1. KSDS: Employee Master (keyed lookup by employee ID)
//* Record: 80 bytes, Key: 8 bytes at offset 20 (cols 21-28)
//* FREESPACE: 20% CI, 10% CA for insert performance
//* SHAREOPTIONS(2 3): Cross-region read, exclusive write
//* ----------------------------------------------------------------
//DEFINEKS EXEC PGM=IDCAMS
//SYSPRINT DD SYSOUT=*
//SYSIN    DD *
  DEFINE CLUSTER (NAME(&HLQ..EXPENSE.MASTER) -
         INDEXED KEYS(8 20) RECORDSIZE(80 80) -
         FREESPACE(20 10) SHAREOPTIONS(2 3)) -
         DATA (NAME(&HLQ..EXPENSE.MASTER.DATA) CYLINDERS(5 2)) -
         INDEX (NAME(&HLQ..EXPENSE.MASTER.INDEX) CYLINDERS(1 1))
/*
//*
//* Load sorted employee master PS into KSDS (runs only if DEFINE RC=0)
//LOADKS   EXEC PGM=IDCAMS,COND=(0,NE,DEFINEKS)
//SYSPRINT DD SYSOUT=*
//EMPPS    DD DSN=&HLQ..EMPLOYEE.MASTER,DISP=SHR
//EMPKSDS  DD DSN=&HLQ..EXPENSE.MASTER,DISP=OLD
//SYSIN    DD *
  REPRO INFILE(EMPPS) OUTFILE(EMPKSDS)
/*
//*
//* Verify KSDS load
//LISTKS   EXEC PGM=IDCAMS,COND=(0,NE,LOADKS)
//SYSPRINT DD SYSOUT=*
//SYSIN    DD *
  LISTCAT ENTRIES(&HLQ..EXPENSE.MASTER) ALL
/*
//*
//* ----------------------------------------------------------------
//* 2. ESDS: Audit Log (EXPENSE.AUDIT) - sequential append, timestamp order
//* Record: Variable length (audit event data), RBA addressing
//* Use case: Immutable audit trail, batch job logging
//* ----------------------------------------------------------------
//DEFINESD EXEC PGM=IDCAMS
//SYSPRINT DD SYSOUT=*
//SYSIN    DD *
  DEFINE CLUSTER (NAME(&HLQ..EXPENSE.AUDIT) -
         NONINDEXED RECORDSIZE(100 300) -
         SHAREOPTIONS(2 3)) -
         DATA (NAME(&HLQ..EXPENSE.AUDIT.DATA) CYLINDERS(10 5))
/*
//*
//* ----------------------------------------------------------------
//* 3. RRDS: Batch Control Records (BATCH.CONTROL) - relative record access
//* Record: Fixed 80 bytes, Relative Record Number = batch run sequence
//* Use case: Batch run metadata, checkpoint/restart data
//* ----------------------------------------------------------------
//DEFINERD EXEC PGM=IDCAMS
//SYSPRINT DD SYSOUT=*
//SYSIN    DD *
  DEFINE CLUSTER (NAME(&HLQ..BATCH.CONTROL) -
         NUMBERED RECORDSIZE(80 80) -
         SHAREOPTIONS(2 3)) -
         DATA (NAME(&HLQ..BATCH.CONTROL.DATA) CYLINDERS(2 1))
/*
//*
//* ----------------------------------------------------------------
//* 4. LDS: Linear Data Set - concept note only
//* NOT for ordinary COBOL record processing
//* Used by: Db2 table spaces, system data, specialized apps
//* No record structure - byte-stream access only
//* ----------------------------------------------------------------
//* LDS example (not executable - concept only):
//* DEFINE CLUSTER (NAME(&HLQ..EXPENSE.LDS) -
//*        LINEAR RECORDSIZE(4096 4096)) -
//*        DATA (NAME(&HLQ..EXPENSE.LDS.DATA) CYLINDERS(5 2))
//* COBOL cannot use LDS directly - requires ACCESS METHOD SERVICES
//* or specialized system interfaces
//* ================================================================