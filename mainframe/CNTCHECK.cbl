       IDENTIFICATION DIVISION.
       PROGRAM-ID. CNTCHECK.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT IN-FILE ASSIGN TO INFILE
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-IN.
           SELECT OUT-FILE ASSIGN TO OUTFILE
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-OUT.
       DATA DIVISION.
       FILE SECTION.
       FD IN-FILE RECORDING MODE F.
       01 IN-REC PIC X(80).
       FD OUT-FILE RECORDING MODE F.
       01 OUT-REC PIC X(80).
       WORKING-STORAGE SECTION.
       01 FS-IN PIC XX.
       01 FS-OUT PIC XX.
       01 IN-EOF PIC X VALUE 'N'.
          88 IN-DONE VALUE 'Y'.
       01 OUT-EOF PIC X VALUE 'N'.
          88 OUT-DONE VALUE 'Y'.
       01 OPEN-IN PIC X VALUE 'N'.
       01 OPEN-OUT PIC X VALUE 'N'.
       01 IN-COUNT PIC 9(9) COMP-5 VALUE 0.
       01 OUT-COUNT PIC 9(9) COMP-5 VALUE 0.
       PROCEDURE DIVISION.
       MAIN-PARA.
           OPEN INPUT IN-FILE OUT-FILE
           IF FS-IN = '00' MOVE 'Y' TO OPEN-IN END-IF
           IF FS-OUT = '00' MOVE 'Y' TO OPEN-OUT END-IF
           IF FS-IN NOT = '00' OR FS-OUT NOT = '00'
              DISPLAY 'OPEN ERROR INPUT=' FS-IN ' OUTPUT=' FS-OUT
              MOVE 12 TO RETURN-CODE
              PERFORM CLOSE-OPEN-FILES
              GOBACK
           END-IF
           PERFORM UNTIL IN-DONE OR RETURN-CODE = 12
              READ IN-FILE
              EVALUATE FS-IN
                WHEN '10' SET IN-DONE TO TRUE
                WHEN '00' ADD 1 TO IN-COUNT
                WHEN OTHER
                  DISPLAY 'INPUT READ ERROR ' FS-IN
                  MOVE 12 TO RETURN-CODE
              END-EVALUATE
           END-PERFORM
           PERFORM UNTIL OUT-DONE OR RETURN-CODE = 12
              READ OUT-FILE
              EVALUATE FS-OUT
                WHEN '10' SET OUT-DONE TO TRUE
                WHEN '00' ADD 1 TO OUT-COUNT
                WHEN OTHER
                  DISPLAY 'OUTPUT READ ERROR ' FS-OUT
                  MOVE 12 TO RETURN-CODE
              END-EVALUATE
           END-PERFORM
           PERFORM CLOSE-OPEN-FILES
           DISPLAY 'INPUT COUNT  : ' IN-COUNT
           DISPLAY 'OUTPUT COUNT : ' OUT-COUNT
           IF RETURN-CODE NOT = 12
              IF IN-COUNT = OUT-COUNT
                 DISPLAY 'COUNT CHECK PASSED'
                 MOVE 0 TO RETURN-CODE
              ELSE
                 DISPLAY 'COUNT CHECK FAILED'
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF
           GOBACK.
       CLOSE-OPEN-FILES.
           IF OPEN-IN = 'Y'
              CLOSE IN-FILE
              IF FS-IN NOT = '00'
                 DISPLAY 'INPUT CLOSE ERROR ' FS-IN
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF
           IF OPEN-OUT = 'Y'
              CLOSE OUT-FILE
              IF FS-OUT NOT = '00'
                 DISPLAY 'OUTPUT CLOSE ERROR ' FS-OUT
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF.
