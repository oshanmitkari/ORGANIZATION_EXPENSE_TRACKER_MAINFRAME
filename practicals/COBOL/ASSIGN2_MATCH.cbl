      * ASSIGN2_MATCH - Match transactions (FILE1) against employee master (FILE2)
      * FILE1: transactions, key at columns 13-20 (8 bytes, employee ID)
      * FILE2: employee master, key at columns 21-28 (8 bytes, employee ID)
      * FILE3: matched FILE1 records (output)
      * FILE4: unmatched FILE1 records with reason (110 bytes: 80 data + 30 reason)
      * Inputs are NOT guaranteed sorted - uses in-memory table lookup
      * Handles: empty files, duplicate keys on either side, all FILE STATUS values
      * DISPLAYs: read/matched/written/unmatched counts for both files
      * RC: 0 (success), 4 (unmatched found), 12 (file error)
       IDENTIFICATION DIVISION.
       PROGRAM-ID. ASSIGN2MT.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT FILE1-TRANS ASSIGN TO FILE1
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-F1.
           SELECT FILE2-MASTER ASSIGN TO FILE2
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-F2.
           SELECT FILE3-MATCHED ASSIGN TO FILE3
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-F3.
           SELECT FILE4-UNMATCHED ASSIGN TO FILE4
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-F4.
       DATA DIVISION.
       FILE SECTION.
       FD  FILE1-TRANS RECORDING MODE F.
       01  F1-REC.
           05 F1-TXN-ID     PIC X(12).
           05 F1-EMP-ID     PIC X(08).
           05 F1-REST       PIC X(60).
       FD  FILE2-MASTER RECORDING MODE F.
       01  F2-REC.
           05 F2-FILLER     PIC X(20).
           05 F2-EMP-ID     PIC X(08).
           05 F2-REST       PIC X(52).
       FD  FILE3-MATCHED RECORDING MODE F.
       01  F3-REC           PIC X(80).
       FD  FILE4-UNMATCHED RECORDING MODE F.
       01  F4-REC.
           05 F4-DATA       PIC X(80).
           05 F4-REASON     PIC X(30).
       WORKING-STORAGE SECTION.
       01  FS-F1            PIC XX.
       01  FS-F2            PIC XX.
       01  FS-F3            PIC XX.
       01  FS-F4            PIC XX.
       01  OPEN-FLAGS.
           05 OPEN-F1       PIC X VALUE 'N'.
           05 OPEN-F2       PIC X VALUE 'N'.
           05 OPEN-F3       PIC X VALUE 'N'.
           05 OPEN-F4       PIC X VALUE 'N'.
       01  EOF1             PIC X VALUE 'N'.
          88 END-F1         VALUE 'Y'.
       01  EOF2             PIC X VALUE 'N'.
          88 END-F2         VALUE 'Y'.
       01  MASTER-CNT       PIC 9(06) COMP VALUE 0.
       01  TRANS-READ-CNT   PIC 9(06) COMP VALUE 0.
       01  MATCHED-CNT      PIC 9(06) COMP VALUE 0.
       01  UNMATCHED-CNT    PIC 9(06) COMP VALUE 0.
       01  MASTER-DUP-CNT   PIC 9(06) COMP VALUE 0.
       01  TRANS-DUP-CNT    PIC 9(06) COMP VALUE 0.
       01  FOUND-SW         PIC X VALUE 'N'.
          88 KEY-FOUND      VALUE 'Y'.
       01  MASTER-TABLE.
           05 MSTR-KEY OCCURS 10000 TIMES
              INDEXED BY MSTR-IX PIC X(08).
       01  TRANS-TABLE.
           05 TRNS-KEY OCCURS 10000 TIMES
              INDEXED BY TRNS-IX PIC X(08).
       01  UNMATCHED-REC.
           05 UNMATCHED-DATA PIC X(80).
           05 UNMATCHED-WHY  PIC X(30).
       01  WS-KEY           PIC X(08).
       01  WS-REASON        PIC X(30).
       PROCEDURE DIVISION.
       MAIN-PARA.
           OPEN INPUT FILE1-TRANS FILE2-MASTER
                OUTPUT FILE3-MATCHED FILE4-UNMATCHED
           IF FS-F1 = '00' MOVE 'Y' TO OPEN-F1 END-IF
           IF FS-F2 = '00' MOVE 'Y' TO OPEN-F2 END-IF
           IF FS-F3 = '00' MOVE 'Y' TO OPEN-F3 END-IF
           IF FS-F4 = '00' MOVE 'Y' TO OPEN-F4 END-IF
           IF FS-F1 NOT = '00' OR FS-F2 NOT = '00'
              OR FS-F3 NOT = '00' OR FS-F4 NOT = '00'
              DISPLAY 'OPEN ERROR ' FS-F1 ' ' FS-F2 ' '
                      FS-F3 ' ' FS-F4
              MOVE 12 TO RETURN-CODE
              PERFORM CLOSE-OPEN-FILES
              GOBACK
           END-IF
           PERFORM LOAD-MASTER-TABLE UNTIL END-F2 OR RETURN-CODE = 12
           IF RETURN-CODE NOT = 12
              PERFORM MATCH-TRANS-FILE UNTIL END-F1
                    OR RETURN-CODE = 12
           END-IF
           DISPLAY 'MASTER RECORDS READ  : ' MASTER-CNT
           DISPLAY 'MASTER DUPLICATE KEYS: ' MASTER-DUP-CNT
           DISPLAY 'TRANS RECORDS READ   : ' TRANS-READ-CNT
           DISPLAY 'TRANS DUPLICATE KEYS : ' TRANS-DUP-CNT
           DISPLAY 'MATCHED WRITTEN      : ' MATCHED-CNT
           DISPLAY 'UNMATCHED WRITTEN    : ' UNMATCHED-CNT
           PERFORM CLOSE-OPEN-FILES
           IF UNMATCHED-CNT > 0 AND RETURN-CODE NOT = 12
              MOVE 4 TO RETURN-CODE
           END-IF
           GOBACK.
       LOAD-MASTER-TABLE.
           READ FILE2-MASTER
           EVALUATE FS-F2
             WHEN '10' SET END-F2 TO TRUE
             WHEN '00'
               ADD 1 TO MASTER-CNT
               MOVE F2-EMP-ID TO WS-KEY
               IF MASTER-CNT > 1
                  SET MSTR-IX TO 1
                  PERFORM UNTIL MSTR-IX > MASTER-CNT - 1
                     OR KEY-FOUND
                    IF MSTR-KEY(MSTR-IX) = WS-KEY
                       SET KEY-FOUND TO TRUE
                    ELSE
                       SET MSTR-IX UP BY 1
                    END-IF
                  END-PERFORM
                  IF KEY-FOUND
                     ADD 1 TO MASTER-DUP-CNT
                     MOVE 'N' TO FOUND-SW
                  END-IF
               END-IF
               IF MASTER-CNT <= 10000
                  MOVE WS-KEY TO MSTR-KEY(MASTER-CNT)
               ELSE
                  DISPLAY 'MASTER TABLE CAPACITY EXCEEDED'
                  MOVE 12 TO RETURN-CODE
                  SET END-F2 TO TRUE
               END-IF
             WHEN OTHER
               DISPLAY 'MASTER READ ERROR ' FS-F2
               MOVE 12 TO RETURN-CODE
               SET END-F2 TO TRUE
           END-EVALUATE.
       MATCH-TRANS-FILE.
           READ FILE1-TRANS
           EVALUATE FS-F1
             WHEN '10' SET END-F1 TO TRUE
             WHEN '00'
               ADD 1 TO TRANS-READ-CNT
               MOVE F1-EMP-ID TO WS-KEY
               IF TRANS-READ-CNT > 1
                  SET TRNS-IX TO 1
                  PERFORM UNTIL TRNS-IX > TRANS-READ-CNT - 1
                     OR KEY-FOUND
                    IF TRNS-KEY(TRNS-IX) = WS-KEY
                       SET KEY-FOUND TO TRUE
                    ELSE
                       SET TRNS-IX UP BY 1
                    END-IF
                  END-PERFORM
                  IF KEY-FOUND
                     ADD 1 TO TRANS-DUP-CNT
                     MOVE 'N' TO FOUND-SW
                  END-IF
               END-IF
               IF TRANS-READ-CNT <= 10000
                  MOVE WS-KEY TO TRNS-KEY(TRANS-READ-CNT)
               END-IF
               MOVE 'N' TO FOUND-SW
               IF MASTER-CNT > 0
                  SET MSTR-IX TO 1
                  PERFORM UNTIL MSTR-IX > MASTER-CNT
                     OR KEY-FOUND
                    IF MSTR-KEY(MSTR-IX) = WS-KEY
                       SET KEY-FOUND TO TRUE
                    ELSE
                       SET MSTR-IX UP BY 1
                    END-IF
                  END-PERFORM
               END-IF
               IF KEY-FOUND
                  WRITE F3-REC FROM F1-REC
                  IF FS-F3 = '00'
                     ADD 1 TO MATCHED-CNT
                  ELSE
                     DISPLAY 'MATCH OUTPUT ERROR ' FS-F3
                     MOVE 12 TO RETURN-CODE
                  END-IF
               ELSE
                  MOVE F1-REC TO UNMATCHED-DATA
                  IF MASTER-CNT = 0
                     MOVE 'EMPTY EMPLOYEE MASTER' TO UNMATCHED-WHY
                  ELSE
                     MOVE 'EMPLOYEE NOT IN MASTER' TO UNMATCHED-WHY
                  END-IF
                  WRITE F4-REC FROM UNMATCHED-REC
                  IF FS-F4 = '00'
                     ADD 1 TO UNMATCHED-CNT
                  ELSE
                     DISPLAY 'UNMATCHED OUTPUT ERROR ' FS-F4
                     MOVE 12 TO RETURN-CODE
                  END-IF
               END-IF
             WHEN OTHER
               DISPLAY 'TRANS READ ERROR ' FS-F1
               MOVE 12 TO RETURN-CODE
               SET END-F1 TO TRUE
           END-EVALUATE.
       CLOSE-OPEN-FILES.
           IF OPEN-F1 = 'Y'
              CLOSE FILE1-TRANS
              IF FS-F1 NOT = '00'
                 DISPLAY 'FILE1 CLOSE ERROR ' FS-F1
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF
           IF OPEN-F2 = 'Y'
              CLOSE FILE2-MASTER
              IF FS-F2 NOT = '00'
                 DISPLAY 'FILE2 CLOSE ERROR ' FS-F2
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF
           IF OPEN-F3 = 'Y'
              CLOSE FILE3-MATCHED
              IF FS-F3 NOT = '00'
                 DISPLAY 'FILE3 CLOSE ERROR ' FS-F3
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF
           IF OPEN-F4 = 'Y'
              CLOSE FILE4-UNMATCHED
              IF FS-F4 NOT = '00'
                 DISPLAY 'FILE4 CLOSE ERROR ' FS-F4
                 MOVE 12 TO RETURN-CODE
              END-IF
           END-IF.
