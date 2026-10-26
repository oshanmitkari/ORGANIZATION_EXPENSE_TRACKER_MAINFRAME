      * Project-owned employee master: exactly 80 bytes.
      * Employee ID is the KSDS key at bytes 1-8.
       01 EMPLOYEE-RECORD.
          05 EMPLOYEE-KEY   PIC X(08).
          05 EMPLOYEE-NAME  PIC X(30).
          05 EMPLOYEE-DEPT  PIC X(10).
          05 EMPLOYEE-STATUS PIC X(01).
          05 EMPLOYEE-FILLER PIC X(31).
