      * NOTE: DD names stay FILE1-FILE4 (see EXPPIPE.jcl); only the
      * internal COBOL file-names were changed so GnuCOBOL accepts them.
       IDENTIFICATION DIVISION.
       PROGRAM-ID. MATCH2.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT TRANS-FILE ASSIGN TO FILE1
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS1.
           SELECT MASTER-FILE ASSIGN TO FILE2
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS2.
           SELECT MATCHED-FILE ASSIGN TO FILE3
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS3.
           SELECT UNKNOWN-FILE ASSIGN TO FILE4
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS4.
       DATA DIVISION.
       FILE SECTION.
       FD  TRANS-FILE RECORDING MODE F.
       01  F1-REC.
           05 F1-ID            PIC X(12).
           05 F1-KEY           PIC X(08).
           05 FILLER           PIC X(60).
       FD  MASTER-FILE RECORDING MODE F.
       01  F2-REC.
           05 FILLER           PIC X(20).
           05 F2-KEY           PIC X(08).
           05 FILLER           PIC X(52).
       FD  MATCHED-FILE RECORDING MODE F.
       01  F3-REC              PIC X(80).
       FD  UNKNOWN-FILE RECORDING MODE F.
       01  F4-REC.
           05 F4-DATA           PIC X(80).
           05 F4-REASON         PIC X(30).
       WORKING-STORAGE SECTION.
       01  FS1                 PIC XX.
       01  FS2                 PIC XX.
       01  FS3                 PIC XX.
       01  FS4                 PIC XX.
       01  OPEN-FLAGS.
           05 OPEN-F1          PIC X VALUE 'N'.
           05 OPEN-F2          PIC X VALUE 'N'.
           05 OPEN-F3          PIC X VALUE 'N'.
           05 OPEN-F4          PIC X VALUE 'N'.
       01  EOF1                PIC X VALUE 'N'.
           88 END-F1           VALUE 'Y'.
       01  EOF2                PIC X VALUE 'N'.
           88 END-F2           VALUE 'Y'.
       01  KEY-CNT             PIC 9(04) COMP VALUE 0.
       01  MATCHED-CNT         PIC 9(06) COMP VALUE 0.
       01  UNKNOWN-CNT         PIC 9(06) COMP VALUE 0.
       01  FOUND-SW            PIC X VALUE 'N'.
          88 KEY-FOUND         VALUE 'Y'.
       01  KEY-TABLE.
           05 TBL-KEY OCCURS 5000 TIMES
              INDEXED BY IX PIC X(08).
       01  UNMATCHED-REC.
           05 UNMATCHED-DATA   PIC X(80).
           05 UNMATCHED-WHY    PIC X(30).
       PROCEDURE DIVISION.
       MAIN-PARA.
           OPEN INPUT TRANS-FILE MASTER-FILE
                OUTPUT MATCHED-FILE UNKNOWN-FILE
           IF FS1 = '00' MOVE 'Y' TO OPEN-F1 END-IF
           IF FS2 = '00' MOVE 'Y' TO OPEN-F2 END-IF
           IF FS3 = '00' MOVE 'Y' TO OPEN-F3 END-IF
           IF FS4 = '00' MOVE 'Y' TO OPEN-F4 END-IF
           IF FS1 NOT = '00' OR FS2 NOT = '00'
              OR FS3 NOT = '00' OR FS4 NOT = '00'
              DISPLAY 'OPEN ERROR ' FS1 ' ' FS2 ' '
                      FS3 ' ' FS4
              MOVE 12 TO RETURN-CODE
              PERFORM CLOSE-OPEN-FILES
              GOBACK
           END-IF
           PERFORM LOAD-MASTER-FILE UNTIL END-F2 OR RETURN-CODE = 12
           IF RETURN-CODE NOT = 12
              PERFORM MATCH-TRANS-FILE UNTIL END-F1
                    OR RETURN-CODE = 12
           END-IF
           DISPLAY 'MATCHED RECORDS : ' MATCHED-CNT
           DISPLAY 'UNKNOWN EMPLOYEES: ' UNKNOWN-CNT
           PERFORM CLOSE-OPEN-FILES
           IF UNKNOWN-CNT > 0 AND RETURN-CODE NOT = 12
              MOVE 4 TO RETURN-CODE
           END-IF
           GOBACK.
       LOAD-MASTER-FILE.
           READ MASTER-FILE
           EVALUATE FS2
             WHEN '10' SET END-F2 TO TRUE
             WHEN '00'
               IF KEY-CNT >= 5000
                  DISPLAY 'EMPLOYEE MASTER CAPACITY EXCEEDED'
                  MOVE 12 TO RETURN-CODE
                  SET END-F2 TO TRUE
               ELSE
                  ADD 1 TO KEY-CNT
                  MOVE F2-KEY TO TBL-KEY(KEY-CNT)
               END-IF
             WHEN OTHER
               DISPLAY 'EMPLOYEE MASTER READ ERROR ' FS2
               MOVE 12 TO RETURN-CODE
               SET END-F2 TO TRUE
           END-EVALUATE.
       MATCH-TRANS-FILE.
           READ TRANS-FILE
           EVALUATE FS1
             WHEN '10' SET END-F1 TO TRUE
             WHEN '00'
               MOVE 'N' TO FOUND-SW
               IF KEY-CNT > 0
                  SET IX TO 1
                  PERFORM UNTIL IX > KEY-CNT OR KEY-FOUND
                    IF TBL-KEY(IX) = F1-KEY
                       SET KEY-FOUND TO TRUE
                    ELSE
                       SET IX UP BY 1
                    END-IF
                  END-PERFORM
               END-IF
               IF KEY-FOUND
                  WRITE F3-REC FROM F1-REC
                  IF FS3 = '00'
                     ADD 1 TO MATCHED-CNT
                  ELSE
                     DISPLAY 'MATCH OUTPUT ERROR ' FS3
                     MOVE 12 TO RETURN-CODE
                  END-IF
               ELSE
                  MOVE F1-REC TO UNMATCHED-DATA
                  IF KEY-CNT = 0
                     MOVE 'EMPTY EMPLOYEE MASTER' TO UNMATCHED-WHY
                  ELSE
                     MOVE 'EMPLOYEE NOT IN MASTER' TO UNMATCHED-WHY
                  END-IF
                  WRITE F4-REC FROM UNMATCHED-REC
                  IF FS4 = '00'
                     ADD 1 TO UNKNOWN-CNT
                  ELSE
                     DISPLAY 'UNKNOWN OUTPUT ERROR ' FS4
                     MOVE 12 TO RETURN-CODE
                  END-IF
               END-IF
             WHEN OTHER
               DISPLAY 'TRANSACTION READ ERROR ' FS1
               MOVE 12 TO RETURN-CODE
               SET END-F1 TO TRUE
           END-EVALUATE.
       CLOSE-OPEN-FILES.
           IF OPEN-F1 = 'Y'
              CLOSE TRANS-FILE
              IF FS1 NOT = '00'
                 DISPLAY 'TRANS-FILE CLOSE ERROR ' FS1
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF
           IF OPEN-F2 = 'Y'
              CLOSE MASTER-FILE
              IF FS2 NOT = '00'
                 DISPLAY 'MASTER-FILE CLOSE ERROR ' FS2
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF
           IF OPEN-F3 = 'Y'
              CLOSE MATCHED-FILE
              IF FS3 NOT = '00'
                 DISPLAY 'MATCHED-FILE CLOSE ERROR ' FS3
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF
           IF OPEN-F4 = 'Y'
              CLOSE UNKNOWN-FILE
              IF FS4 NOT = '00'
                 DISPLAY 'UNKNOWN-FILE CLOSE ERROR ' FS4
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF.
