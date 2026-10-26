       IDENTIFICATION DIVISION.
       PROGRAM-ID. EXPPOST.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT TRANS-IN ASSIGN TO TRANSIN
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-IN.
           SELECT EXPENSE-MASTER ASSIGN TO EXPVSAM
               ORGANIZATION IS INDEXED
               ACCESS MODE IS DYNAMIC
               RECORD KEY IS MASTER-KEY
               FILE STATUS IS FS-VSAM.
           SELECT EMPLOYEE-MASTER ASSIGN TO EMPVSAM
               ORGANIZATION IS INDEXED
               ACCESS MODE IS DYNAMIC
               RECORD KEY IS EMPLOYEE-KEY
               FILE STATUS IS FS-EMP.
           SELECT RESULT-OUT ASSIGN TO RESULT
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-RESULT.
       DATA DIVISION.
       FILE SECTION.
       FD TRANS-IN RECORDING MODE F.
       01 INPUT-RECORD PIC X(80).
       FD EXPENSE-MASTER.
       01 MASTER-RECORD.
          05 MASTER-KEY PIC X(12).
          05 FILLER PIC X(68).
       FD EMPLOYEE-MASTER.
       COPY EMPCOPY.
       FD RESULT-OUT RECORDING MODE F.
       01 RESULT-RECORD PIC X(120).
       WORKING-STORAGE SECTION.
       COPY EXPCOPY.
       01 FS-IN PIC XX.
       01 FS-VSAM PIC XX.
       01 FS-EMP PIC XX.
       01 FS-RESULT PIC XX.
       01 EOF-SW PIC X VALUE 'N'.
          88 AT-EOF VALUE 'Y'.
       01 WS-STATUS PIC X(12).
       01 WS-REASON PIC X(40).
       01 WS-REFERENCE PIC X(30) VALUE SPACES.
       01 CNT-READ PIC 9(9) COMP-5 VALUE 0.
       01 CNT-POSTED PIC 9(9) COMP-5 VALUE 0.
       01 CNT-REJECTED PIC 9(9) COMP-5 VALUE 0.
       01 EMP-ID PIC X(08).
       01 WS-MONTH PIC 99.
       01 WS-DAY PIC 99.
       PROCEDURE DIVISION.
       MAIN.
           OPEN INPUT TRANS-IN
                I-O EXPENSE-MASTER
                INPUT EMPLOYEE-MASTER
                OUTPUT RESULT-OUT
           IF FS-IN NOT = '00'
              OR FS-VSAM NOT = '00'
              OR FS-EMP NOT = '00'
              OR FS-RESULT NOT = '00'
               DISPLAY 'OPEN ERROR IN=' FS-IN
                   ' VSAM=' FS-VSAM ' EMP=' FS-EMP
               MOVE 12 TO RETURN-CODE
               GOBACK
           END-IF
           PERFORM UNTIL AT-EOF
               READ TRANS-IN
                   AT END SET AT-EOF TO TRUE
                   NOT AT END PERFORM POST-ONE
               END-READ
           END-PERFORM
           CLOSE TRANS-IN EXPENSE-MASTER
                 EMPLOYEE-MASTER RESULT-OUT
           DISPLAY 'EXPPOST READ=' CNT-READ
               ' POSTED=' CNT-POSTED
               ' REJECTED=' CNT-REJECTED
           IF CNT-REJECTED > 0
               MOVE 4 TO RETURN-CODE
           END-IF
           GOBACK.
       POST-ONE.
           ADD 1 TO CNT-READ
           MOVE SPACES TO WS-REASON
           MOVE SPACES TO WS-REFERENCE
           MOVE INPUT-RECORD TO EXPENSE-RECORD
           IF EXP-ID = SPACES
               MOVE 'MISSING EXPENSE ID' TO WS-REASON
           END-IF
           IF WS-REASON = SPACES
              AND EXP-AMOUNT IS NOT NUMERIC
               MOVE 'AMOUNT MUST BE NUMERIC' TO WS-REASON
           END-IF
           IF WS-REASON = SPACES
              AND EXP-AMOUNT = '000000000'
               MOVE 'AMOUNT MUST BE POSITIVE' TO WS-REASON
           END-IF
           IF WS-REASON = SPACES
              AND EXP-DATE IS NOT NUMERIC
               MOVE 'DATE MUST BE YYYYMMDD' TO WS-REASON
           END-IF
           IF WS-REASON = SPACES
               MOVE EXP-DATE(5:2) TO WS-MONTH
               MOVE EXP-DATE(7:2) TO WS-DAY
               IF WS-MONTH < 1 OR WS-MONTH > 12
                   MOVE 'INVALID CALENDAR DATE' TO WS-REASON
               END-IF
               IF WS-DAY < 1 OR WS-DAY > 31
                   MOVE 'INVALID CALENDAR DATE' TO WS-REASON
               END-IF
           END-IF
           IF WS-REASON = SPACES
              AND EXP-CATEGORY NOT = 'FOOD'
              AND EXP-CATEGORY NOT = 'TRVL'
              AND EXP-CATEGORY NOT = 'OFFC'
              AND EXP-CATEGORY NOT = 'MEDC'
              AND EXP-CATEGORY NOT = 'UTIL'
              AND EXP-CATEGORY NOT = 'TRNG'
              AND EXP-CATEGORY NOT = 'COMM'
              AND EXP-CATEGORY NOT = 'OTHR'
               MOVE 'UNKNOWN CATEGORY' TO WS-REASON
           END-IF
           IF WS-REASON = SPACES
               MOVE EXP-EMP-ID TO EMP-ID
               MOVE EMP-ID TO EMPLOYEE-KEY
               READ EMPLOYEE-MASTER KEY IS EMPLOYEE-KEY
                   INVALID KEY
                       MOVE 'EMPLOYEE NOT ELIGIBLE' TO WS-REASON
                   NOT INVALID KEY
                       IF EMPLOYEE-STATUS NOT = 'A'
                           MOVE 'EMPLOYEE NOT ACTIVE' TO WS-REASON
                       END-IF
               END-READ
           END-IF
           IF WS-REASON = SPACES
               MOVE EXP-ID TO MASTER-KEY
               READ EXPENSE-MASTER KEY IS MASTER-KEY
                   INVALID KEY
                       IF FS-VSAM NOT = '23'
                           MOVE 'VSAM READ ERROR' TO WS-REASON
                       END-IF
                   NOT INVALID KEY
                       MOVE 'DUPLICATE EXPENSE ID' TO WS-REASON
               END-READ
           END-IF
           IF WS-REASON = SPACES
               WRITE MASTER-RECORD FROM EXPENSE-RECORD
               IF FS-VSAM = '00'
                   ADD 1 TO CNT-POSTED
                   MOVE 'POSTED' TO WS-STATUS
                   MOVE 'OK' TO WS-REFERENCE
               ELSE
                   MOVE 'VSAM WRITE ERROR' TO WS-REASON
               END-IF
           END-IF
           IF WS-REASON NOT = SPACES
               ADD 1 TO CNT-REJECTED
               MOVE 'REJECTED' TO WS-STATUS
           END-IF
           MOVE SPACES TO RESULT-RECORD
           STRING EXP-ID DELIMITED BY SIZE
               '|' DELIMITED BY SIZE
               WS-STATUS DELIMITED BY SIZE
               '|' DELIMITED BY SIZE
               WS-REASON DELIMITED BY SIZE
               '|' DELIMITED BY SIZE
               WS-REFERENCE DELIMITED BY SIZE
               INTO RESULT-RECORD
           END-STRING
           WRITE RESULT-RECORD
           IF FS-RESULT NOT = '00'
               MOVE 12 TO RETURN-CODE
           END-IF.
