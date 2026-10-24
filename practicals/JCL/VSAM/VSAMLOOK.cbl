* VSAMLOOK - VSAM KSDS Employee Master Operations
      * Assignment: KSDS read by key, update, delete, duplicate-key handling
      * Backup/restore with REPRO/EXPORT/IMPORT (IDCAMS in JCL)
      * Local: GnuCOBOL INDEXED files (NOT VSAM - labeled accordingly)
      * z/OS: IDCAMS REPRO/EXPORT/IMPORT for backup/restore
       IDENTIFICATION DIVISION.
       PROGRAM-ID. VSAMLOOK.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT TRANS-IN ASSIGN TO TRANSIN
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-TRANS.
           SELECT EMPLOYEE-FILE ASSIGN TO EMPKSDS
               ORGANIZATION IS INDEXED
               ACCESS MODE IS DYNAMIC
               RECORD KEY IS EMPLOYEE-KEY
               FILE STATUS IS FS-EMP.
           SELECT MATCH-OUT ASSIGN TO MATCHOUT
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-MATCH.
           SELECT REJECT-OUT ASSIGN TO REJOUT
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-REJECT.
       DATA DIVISION.
       FILE SECTION.
       FD  TRANS-IN RECORDING MODE F.
       01  TRANS-REC.
           05 TRANS-ID       PIC X(12).
           05 TRANS-EMP      PIC X(08).
           05 FILLER         PIC X(60).
       FD  EMPLOYEE-FILE RECORDING MODE F.
       01  EMPLOYEE-REC.
           05 FILLER         PIC X(20).
           05 EMPLOYEE-KEY   PIC X(08).
           05 EMP-NAME       PIC X(20).
           05 EMP-DEPT       PIC X(08).
           05 EMP-HIRE       PIC X(08).
           05 EMP-STATUS     PIC X(01).
           05 FILLER         PIC X(23).
       FD  MATCH-OUT RECORDING MODE F.
       01  MATCH-REC         PIC X(80).
       FD  REJECT-OUT RECORDING MODE F.
       01  REJECT-REC.
           05 REJECT-DATA    PIC X(80).
           05 REJECT-REASON  PIC X(30).
       WORKING-STORAGE SECTION.
       01  FS-TRANS          PIC XX.
       01  FS-EMP            PIC XX.
       01  FS-MATCH          PIC XX.
       01  FS-REJECT         PIC XX.
       01  EOF-SW            PIC X VALUE 'N'.
          88 AT-EOF          VALUE 'Y'.
       01  WS-REASON         PIC X(30).
       01  WS-COUNT          PIC 9(09) COMP-5 VALUE 0.
       01  OPEN-FLAGS.
           05 OPEN-TRANS     PIC X VALUE 'N'.
           05 OPEN-EMP       PIC X VALUE 'N'.
           05 OPEN-MATCH     PIC X VALUE 'N'.
           05 OPEN-REJECT    PIC X VALUE 'N'.
       PROCEDURE DIVISION.
       MAIN-PARA.
           OPEN INPUT TRANS-IN EMPLOYEE-FILE
                OUTPUT MATCH-OUT REJECT-OUT
           IF FS-TRANS = '00' MOVE 'Y' TO OPEN-TRANS END-IF
           IF FS-EMP = '00' MOVE 'Y' TO OPEN-EMP END-IF
           IF FS-MATCH = '00' MOVE 'Y' TO OPEN-MATCH END-IF
           IF FS-REJECT = '00' MOVE 'Y' TO OPEN-REJECT END-IF
           IF FS-TRANS NOT = '00' OR FS-EMP NOT = '00'
              OR FS-MATCH NOT = '00' OR FS-REJECT NOT = '00'
              DISPLAY 'OPEN ERROR ' FS-TRANS ' ' FS-EMP
                      ' ' FS-MATCH ' ' FS-REJECT
              MOVE 12 TO RETURN-CODE
              PERFORM CLOSE-OPEN-FILES
              GOBACK
           END-IF
           PERFORM UNTIL AT-EOF OR RETURN-CODE = 12
              READ TRANS-IN
              EVALUATE FS-TRANS
                WHEN '10' SET AT-EOF TO TRUE
                WHEN '00' PERFORM MATCH-CURRENT
                WHEN OTHER
                  DISPLAY 'TRANSACTION READ ERROR ' FS-TRANS
                  MOVE 12 TO RETURN-CODE
              END-EVALUATE
           END-PERFORM
           PERFORM CLOSE-OPEN-FILES
           DISPLAY 'RECORDS READ: ' WS-COUNT
           GOBACK.
       MATCH-CURRENT.
           ADD 1 TO WS-COUNT
           MOVE TRANS-EMP TO EMPLOYEE-KEY
           MOVE SPACES TO WS-REASON
           READ EMPLOYEE-FILE KEY IS EMPLOYEE-KEY
             INVALID KEY
               IF FS-EMP = '23'
                  MOVE 'EMPLOYEE NOT IN VSAM MASTER' TO WS-REASON
               ELSE
                  DISPLAY 'VSAM LOOKUP ERROR ' FS-EMP
                  MOVE 12 TO RETURN-CODE
               END-IF
           END-READ
           IF RETURN-CODE NOT = 12
              IF WS-REASON = SPACES
                 WRITE MATCH-REC FROM TRANS-REC
                 IF FS-MATCH NOT = '00'
                    DISPLAY 'MATCH OUTPUT ERROR ' FS-MATCH
                    MOVE 12 TO RETURN-CODE
                 END-IF
              ELSE
                 MOVE TRANS-REC TO REJECT-DATA
                 MOVE WS-REASON TO REJECT-REASON
                 WRITE REJECT-REC
                 IF FS-REJECT NOT = '00'
                    DISPLAY 'REJECT OUTPUT ERROR ' FS-REJECT
                    MOVE 12 TO RETURN-CODE
                 ELSE
                    IF RETURN-CODE = 0 MOVE 4 TO RETURN-CODE END-IF
                 END-IF
              END-IF
           END-IF.
       CLOSE-OPEN-FILES.
           IF OPEN-TRANS = 'Y' CLOSE TRANS-IN END-IF
           IF OPEN-EMP = 'Y' CLOSE EMPLOYEE-FILE END-IF
           IF OPEN-MATCH = 'Y' CLOSE MATCH-OUT END-IF
           IF OPEN-REJECT = 'Y' CLOSE REJECT-OUT END-IF.