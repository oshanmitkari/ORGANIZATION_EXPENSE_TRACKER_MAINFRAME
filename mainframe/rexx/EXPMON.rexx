/* TSO/E operator helper: validate a result dataset and return a useful RC. */
ADDRESS TSO
PARSE ARG result_dsn
IF result_dsn = '' THEN DO
  SAY 'EXPMON: result dataset argument is required'
  EXIT 12
END
ADDRESS TSO "ALLOC FI(EXPMONIN) DA('"result_dsn"') SHR"
IF RC <> 0 THEN DO; SAY 'EXPMON: cannot allocate result dataset'; EXIT 12; END
ADDRESS TSO "EXECIO * DISKR EXPMONIN (STEM lines. FINIS"
IF RC <> 0 THEN DO; SAY 'EXPMON: EXECIO read failed'; EXIT 12; END
posted = 0; rejected = 0; malformed = 0
DO i = 1 TO lines.0
  PARSE VAR lines.i expense_id '|' status '|' reason '|' reference
  IF expense_id = '' | status = '' THEN malformed = malformed + 1
  ELSE IF status = 'POSTED' THEN posted = posted + 1
  ELSE IF status = 'REJECTED' THEN rejected = rejected + 1
END
ADDRESS TSO "FREE FI(EXPMONIN)"
SAY 'EXPMON SUMMARY: POSTED='posted 'REJECTED='rejected 'MALFORMED='malformed
IF malformed > 0 THEN EXIT 12
IF rejected > 0 THEN EXIT 4
EXIT 0
