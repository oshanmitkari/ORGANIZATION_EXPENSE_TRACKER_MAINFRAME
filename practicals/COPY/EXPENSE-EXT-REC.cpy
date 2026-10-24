* Extended 100-byte expense transaction record for Assignment 3
       * Aligns with PDF Assignment 3: key at columns 25-32 (1-based)
       * Compatible with existing 80-byte layout (EXPENSE-REC.cpy)
       * Field positions are 1-based for JCL/DFSORT compatibility
        01  EXPENSE-EXT-RECORD.
            05  EXT-TXN-ID         PIC X(12).     *  1-12  Transaction identifier
            05  EXT-COST-CENTRE    PIC X(12).     * 13-24  Cost centre (NEW)
            05  EXT-EMP-ID         PIC X(08).     * 25-32  Employee identifier (PRIMARY KEY)
            05  EXT-DATE           PIC X(08).     * 33-40  Transaction date YYYYMMDD
            05  EXT-CATEGORY       PIC X(04).     * 41-44  Category code
            05  EXT-AMOUNT-CENTS   PIC X(09).     * 45-53  Amount in cents (zero-padded)
            05  EXT-DESCRIPTION    PIC X(47).     * 54-100 Description (extended from 39)

       * Mapping from 80-byte EXPENSE-RECORD:
       *   EXP-TXN-ID      (1-12)   -> EXT-TXN-ID      (1-12)
       *   EXP-EMP-ID      (13-20)  -> EXT-EMP-ID      (25-32)  SHIFTED
       *   EXP-DATE        (21-28)  -> EXT-DATE        (33-40)  SHIFTED
       *   EXP-CATEGORY    (29-32)  -> EXT-CATEGORY    (41-44)  SHIFTED
       *   EXP-AMOUNT-CENTS(33-41)  -> EXT-AMOUNT-CENTS(45-53)  SHIFTED
       *   EXP-DESCRIPTION (42-80)  -> EXT-DESCRIPTION (54-100) EXTENDED
       *   NEW: EXT-COST-CENTRE (13-24) inserted after TXN-ID