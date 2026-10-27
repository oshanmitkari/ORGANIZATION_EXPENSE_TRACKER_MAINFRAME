/* TSO/E automation helper: validate EXPPOST result records and return a useful RC. */
ADDRESS TSO
 PARSE UPPER ARG result_dsn
IF result_dsn = '' THEN DO
  SAY 'EXPMON: result dataset argument is required'
  EXIT 12
END
result_dsn = STRIP(result_dsn)
IF LENGTH(result_dsn) > 44 | VERIFY(result_dsn, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.@#$') <> 0 THEN DO
  SAY 'EXPMON: invalid dataset name argument'
  EXIT 12
END
ADDRESS TSO "ALLOC FI(EXPMONIN) DA('"result_dsn"') SHR"
IF RC <> 0 THEN DO; SAY 'EXPMON: cannot allocate result dataset'; EXIT 12; END
ADDRESS TSO "EXECIO * DISKR EXPMONIN (STEM lines. FINIS"
IF RC <> 0 THEN DO
  SAY 'EXPMON: EXECIO read failed'
  ADDRESS TSO 'FREE FI(EXPMONIN)'
  EXIT 12
END
posted = 0; rejected = 0; failed = 0; malformed = 0
DO i = 1 TO lines.0
  PARSE VAR lines.i expense_id '|' status '|' reason '|' reference
  IF expense_id = '' | status = '' THEN malformed = malformed + 1
  ELSE IF status = 'POSTED' THEN posted = posted + 1
  ELSE IF status = 'REJECTED' THEN rejected = rejected + 1
  ELSE failed = failed + 1
END
ADDRESS TSO "FREE FI(EXPMONIN)"
SAY 'EXPMON SUMMARY: POSTED='posted 'REJECTED='rejected 'FAILED='failed 'MALFORMED='malformed
IF malformed > 0 | failed > 0 THEN EXIT 12
IF rejected > 0 THEN EXIT 4
EXIT 0
