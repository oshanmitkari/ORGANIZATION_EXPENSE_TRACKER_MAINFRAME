# Db2 artifacts

- `01-schema.sql` is the original compact expense and employee schema.
- `03-workflow-schema.sql` is the expanded department, employee, category, expense, approval, posting ledger, batch, audit, and reconciliation schema. Choose the schema version and object names with the site DBA; do not deploy overlapping models blindly.
- `02-report-queries.sql` contains sample operational and aggregate queries.
- `POSTEXP.sqc` is an embedded-SQL COBOL posting example. It uses SQLCA, host variables, an idempotent unique posting ledger, audit insert, SQLCODE checks, and COMMIT/ROLLBACK. `POSTEXP.jcl` is a site-specific DSN command template and requires precompile, compile, link-edit, package/plan bind, and subsystem settings.

These are source examples only. They are not a live Db2 connection and have not been precompiled or executed. The local Node app stores workflow state in JSON files, not Db2. Confirm Db2 release syntax, subsystem, package collection, plan, grants, tablespaces, and SQL coding standards with the authorized DBA. Test in a disposable development schema and inspect SQLCODE/SQLSTATE and job output before any deployment.

- `04-operational-queries.sql` adds bound-marker examples for operational status, duplicate keys, batch exceptions, and reconciliation.

