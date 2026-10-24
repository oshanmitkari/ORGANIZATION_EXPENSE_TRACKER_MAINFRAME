       IDENTIFICATION DIVISION.
       PROGRAM-ID. EXPVALID.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT TRANS-IN ASSIGN TO TRANSIN
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-IN.
           SELECT GOOD-OUT ASSIGN TO GOODOUT
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-GOOD.
           SELECT REJ-OUT ASSIGN TO REJOUT
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-REJECT.
       DATA DIVISION.
       FILE SECTION.
       FD TRANS-IN RECORDING MODE F.
       01 TR-REC.
          05 TR-ID             PIC X(12).
          05 TR-EMP            PIC X(08).
          05 TR-DATE           PIC X(08).
          05 TR-CAT             PIC X(04).
          05 TR-AMT-RAW         PIC X(09).
          05 TR-DESC            PIC X(39).
       FD GOOD-OUT RECORDING MODE F.
       01 GOOD-REC              PIC X(80).
       FD REJ-OUT RECORDING MODE F.
       01 REJ-REC.
          05 REJ-DATA           PIC X(80).
          05 REJ-WHY            PIC X(30).
       WORKING-STORAGE SECTION.
       01 FS-IN PIC XX.
       01 FS-GOOD PIC XX.
       01 FS-REJECT PIC XX.
       01 OPEN-FLAGS.
          05 OPEN-IN PIC X VALUE 'N'.
          05 OPEN-GOOD PIC X VALUE 'N'.
          05 OPEN-REJECT PIC X VALUE 'N'.
       01 EOF-SW                PIC X VALUE 'N'.
          88 AT-EOF             VALUE 'Y'.
       01 WHY                   PIC X(30).
       01 CNT-READ              PIC 9(06) VALUE 0.
       01 CNT-GOOD              PIC 9(06) VALUE 0.
       01 CNT-REJ               PIC 9(06) VALUE 0.
       01 WS-YEAR               PIC 9(04).
       01 WS-MONTH              PIC 9(02).
       01 WS-DAY                PIC 9(02).
       01 WS-MAX-DAY            PIC 9(02).
       PROCEDURE DIVISION.
       MAIN-PARA.
           OPEN INPUT TRANS-IN OUTPUT GOOD-OUT REJ-OUT
           IF FS-IN = '00' MOVE 'Y' TO OPEN-IN END-IF
           IF FS-GOOD = '00' MOVE 'Y' TO OPEN-GOOD END-IF
           IF FS-REJECT = '00' MOVE 'Y' TO OPEN-REJECT END-IF
           IF FS-IN NOT = '00' OR FS-GOOD NOT = '00'
              OR FS-REJECT NOT = '00'
              DISPLAY 'OPEN ERROR ' FS-IN ' ' FS-GOOD ' ' FS-REJECT
              MOVE 12 TO RETURN-CODE
              PERFORM CLOSE-OPEN-FILES
              GOBACK
           END-IF
           PERFORM UNTIL AT-EOF OR RETURN-CODE = 12
              READ TRANS-IN
              EVALUATE FS-IN
                WHEN '10' SET AT-EOF TO TRUE
                WHEN '00' PERFORM CHECK-REC
                WHEN OTHER
                  DISPLAY 'INPUT READ ERROR ' FS-IN
                  MOVE 12 TO RETURN-CODE
              END-EVALUATE
           END-PERFORM
           DISPLAY 'READ ' CNT-READ ' GOOD ' CNT-GOOD
                   ' REJECTED ' CNT-REJ
           PERFORM CLOSE-OPEN-FILES
           IF CNT-REJ > 0 AND RETURN-CODE NOT = 12
              MOVE 4 TO RETURN-CODE
           END-IF
           GOBACK.
       CHECK-REC.
           ADD 1 TO CNT-READ
           MOVE SPACES TO WHY
           EVALUATE TRUE
             WHEN TR-AMT-RAW IS NOT NUMERIC
               MOVE 'AMOUNT MUST BE NUMERIC' TO WHY
             WHEN TR-AMT-RAW = '000000000'
               MOVE 'AMOUNT MUST BE > 0' TO WHY
             WHEN TR-DATE IS NOT NUMERIC
               MOVE 'DATE MUST BE YYYYMMDD' TO WHY
             WHEN TR-CAT NOT = 'FOOD' AND 'TRVL' AND 'OFFC'
                  AND 'MEDC' AND 'UTIL' AND 'TRNG'
               MOVE 'UNKNOWN CATEGORY' TO WHY
             WHEN OTHER
               PERFORM CHECK-DATE
           END-EVALUATE
           IF WHY = SPACES
              WRITE GOOD-REC FROM TR-REC
              IF FS-GOOD = '00'
                 ADD 1 TO CNT-GOOD
              ELSE
                 DISPLAY 'VALID OUTPUT WRITE ERROR ' FS-GOOD
                 MOVE 12 TO RETURN-CODE
              END-IF
           ELSE
              MOVE TR-REC TO REJ-DATA
              MOVE WHY TO REJ-WHY
              WRITE REJ-REC
              IF FS-REJECT = '00'
                 ADD 1 TO CNT-REJ
              ELSE
                 DISPLAY 'REJECT OUTPUT WRITE ERROR ' FS-REJECT
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF.
       CHECK-DATE.
           MOVE TR-DATE(1:4) TO WS-YEAR
           MOVE TR-DATE(5:2) TO WS-MONTH
           MOVE TR-DATE(7:2) TO WS-DAY
           MOVE 0 TO WS-MAX-DAY
           EVALUATE WS-MONTH
             WHEN 1 WHEN 3 WHEN 5 WHEN 7 WHEN 8 WHEN 10 WHEN 12
               MOVE 31 TO WS-MAX-DAY
             WHEN 4 WHEN 6 WHEN 9 WHEN 11
               MOVE 30 TO WS-MAX-DAY
             WHEN 2
               MOVE 28 TO WS-MAX-DAY
               IF FUNCTION MOD(WS-YEAR, 400) = 0
                  MOVE 29 TO WS-MAX-DAY
               ELSE
                  IF FUNCTION MOD(WS-YEAR, 4) = 0 AND
                     FUNCTION MOD(WS-YEAR, 100) NOT = 0
                     MOVE 29 TO WS-MAX-DAY
                  END-IF
               END-IF
             WHEN OTHER
               MOVE 'INVALID MONTH' TO WHY
           END-EVALUATE
           IF WHY = SPACES AND
              (WS-DAY < 1 OR WS-DAY > WS-MAX-DAY OR WS-YEAR < 1900)
              MOVE 'INVALID CALENDAR DATE' TO WHY
           END-IF.
       CLOSE-OPEN-FILES.
           IF OPEN-IN = 'Y'
              CLOSE TRANS-IN
              IF FS-IN NOT = '00'
                 DISPLAY 'INPUT CLOSE ERROR ' FS-IN
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF
           IF OPEN-GOOD = 'Y'
              CLOSE GOOD-OUT
              IF FS-GOOD NOT = '00'
                 DISPLAY 'VALID CLOSE ERROR ' FS-GOOD
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF
           IF OPEN-REJECT = 'Y'
              CLOSE REJ-OUT
              IF FS-REJECT NOT = '00'
                 DISPLAY 'REJECT CLOSE ERROR ' FS-REJECT
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF.
