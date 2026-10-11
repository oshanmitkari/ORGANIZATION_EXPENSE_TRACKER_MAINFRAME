# z/OS Setup and Operations

These are deployment templates. Review them with the authorized site operations and DB2 teams before use. No job has been submitted or verified on z/OS as part of the local application.

1. Allocate transaction, clean, matched, valid and report PS datasets as `RECFM=FB,LRECL=80`. Exception records containing an 80-byte transaction plus a 30-byte reason use `LRECL=110`. Confirm every actual COBOL FD and DD uses the same contract.
2. Upload `EXPENSE-REC.cpy`, COBOL, JCL, and REXX sources to approved libraries using the site's transfer and encoding standards.
3. Compile `MATCH2.cbl`, `EXPVALID.cbl`, `CNTCHECK.cbl`, and `VSAMLOOK.cbl` using the authorized compiler procedure. Precompile, compile, link-edit, and bind `db2/POSTEXP.sqc` with the site Db2 procedure, then set its plan and libraries in `db2/POSTEXP.jcl`.
4. Seed `EXPENSE.TRANS` with synthetic 80-byte records and `EMPLOYEE.MASTER` with 80-byte records; employee ID occupies bytes 21–28.
5. Run isolated SORT, ICETOOL, COBOL, VSAM, and Db2 stages in a disposable test HLQ/schema first. Check JES output, DD allocation, record counts, and return codes at each stage.
6. `VSAM-DEFINE.jcl` is non-destructive and fails when the cluster already exists. It defines and then loads the PS employee master into the KSDS only when the DEFINE step succeeds. Use a disposable HLQ and verify allocation and input sort order first.
7. Run DB2 DDL only in an authorized development schema after DBA review. This project does not include a verified fixed-width-to-DB2 loader or live Node connection.
8. RACF examples are illustrative and require site-specific profiles and an authorized administrator. Do not submit them with placeholder group or HLQ values.
9. Retain approved job logs and output evidence for both successful count control and intentional failure. Do not use real personal or financial data in local fixtures.

Dataset names, compiler procedures, DB2 subsystem, RACF permissions, utility options, encoding, and storage allocation vary by installation. Treat the supplied artifacts as adaptable templates, not portable certified production jobs.
