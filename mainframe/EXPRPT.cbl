      * EXPRPT - report step: sort validated records by amount
      * (descending). If environment variable BREAK_COUNT=Y the last
      * record is deliberately NOT written, so CNTCHECK fails (RC 12).
      * DDs: INFILE (valid records), OUTFILE (report)
       IDENTIFICATION DIVISION.
       PROGRAM-ID. EXPRPT.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT SORT-FILE ASSIGN TO SORTWK.
           SELECT IN-FILE ASSIGN TO INFILE
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-IN.
           SELECT OUT-FILE ASSIGN TO OUTFILE
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-OUT.
       DATA DIVISION.
       FILE SECTION.
       SD  SORT-FILE.
       01  SORT-REC.
           05 SR-ID            PIC X(12).
           05 SR-EMP           PIC X(08).
           05 SR-DATE          PIC X(08).
           05 SR-CAT           PIC X(04).
           05 SR-AMT           PIC X(09).
           05 SR-DESC          PIC X(39).
       FD  IN-FILE RECORDING MODE F.
       01  IN-REC              PIC X(80).
       FD  OUT-FILE RECORDING MODE F.
       01  OUT-REC             PIC X(80).
       WORKING-STORAGE SECTION.
       01  FS-IN               PIC XX.
       01  FS-OUT              PIC XX.
       01  SORT-EOF            PIC X VALUE 'N'.
           88 SORT-DONE        VALUE 'Y'.
       01  WS-BREAK            PIC X VALUE 'N'.
       01  HAVE-HOLD           PIC X VALUE 'N'.
       01  WS-CUR              PIC X(80).
       01  WS-HOLD             PIC X(80).
       01  CNT-WRITTEN         PIC 9(06) VALUE 0.
       PROCEDURE DIVISION.
       MAIN-PARA.
           ACCEPT WS-BREAK FROM ENVIRONMENT 'BREAK_COUNT'
           OPEN OUTPUT OUT-FILE
           IF FS-OUT NOT = '00'
              DISPLAY 'OPEN ERROR ' FS-OUT
              MOVE 12 TO RETURN-CODE
              GOBACK
           END-IF
           SORT SORT-FILE
                ON DESCENDING KEY SR-AMT
                ON ASCENDING KEY SR-ID
                ON ASCENDING KEY SR-EMP
                ON ASCENDING KEY SR-DATE
                ON ASCENDING KEY SR-CAT
                ON ASCENDING KEY SR-DESC
                USING IN-FILE
                OUTPUT PROCEDURE IS WRITE-REPORT
           IF SORT-RETURN NOT = 0
              DISPLAY 'SORT FAILED RC=' SORT-RETURN
              MOVE 12 TO RETURN-CODE
           END-IF
      *    The record held back last is written only on a normal run.
           IF HAVE-HOLD = 'Y'
              IF WS-BREAK = 'Y'
                 DISPLAY 'DELIBERATE BREAK: LAST RECORD NOT WRITTEN'
              ELSE
                 WRITE OUT-REC FROM WS-HOLD
                 ADD 1 TO CNT-WRITTEN
              END-IF
           END-IF
           CLOSE OUT-FILE
           DISPLAY 'REPORT RECORDS   : ' CNT-WRITTEN
           GOBACK.
       WRITE-REPORT.
           PERFORM UNTIL SORT-DONE
              RETURN SORT-FILE INTO WS-CUR
                 AT END SET SORT-DONE TO TRUE
                 NOT AT END PERFORM HOLD-AND-WRITE
              END-RETURN
           END-PERFORM.
       HOLD-AND-WRITE.
           IF HAVE-HOLD = 'Y'
              WRITE OUT-REC FROM WS-HOLD
              ADD 1 TO CNT-WRITTEN
           END-IF
           MOVE WS-CUR TO WS-HOLD
           MOVE 'Y' TO HAVE-HOLD.
