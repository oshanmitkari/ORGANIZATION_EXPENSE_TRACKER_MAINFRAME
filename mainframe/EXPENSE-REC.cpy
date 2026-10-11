      * Shared 80-byte layout; synchronize fields with SORT and Node.
      * Keep DB2 import/export mappings aligned with these positions.
       01  EXPENSE-RECORD.
           05 EXP-TXN-ID       PIC X(12).
           05 EXP-EMP-ID       PIC X(08).
           05 EXP-DATE         PIC X(08).
           05 EXP-CATEGORY     PIC X(04).
           05 EXP-AMOUNT-CENTS PIC X(09).
           05 EXP-DESCRIPTION  PIC X(39).
