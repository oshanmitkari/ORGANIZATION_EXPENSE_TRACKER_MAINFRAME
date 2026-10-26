      * Expense transaction and VSAM master record: exactly 80 bytes.
      * Offsets are zero-based here; COBOL positions are 1-based.
       01 EXPENSE-RECORD.
          05 EXP-ID          PIC X(12).  *> bytes 1-12; KSDS key
          05 EXP-EMP-ID      PIC X(08).  *> bytes 13-20
          05 EXP-DATE        PIC X(08).  *> bytes 21-28 YYYYMMDD
          05 EXP-CATEGORY    PIC X(04).  *> bytes 29-32
          05 EXP-AMOUNT      PIC X(09).  *> bytes 33-41 paise
          05 EXP-DESCRIPTION PIC X(39).  *> bytes 42-80, space padded
