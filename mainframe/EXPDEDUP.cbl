      * EXPDEDUP - sort transactions by employee id and remove exact
      * duplicate 80-byte records (COBOL equivalent of the DFSORT
      * SORT FIELDS=(13,8,...) / SUM FIELDS=NONE step in EXPPIPE.jcl).
      * DDs: TRANSIN (input), CLEANOUT (unique, sorted), DUPSOUT (dups)
       IDENTIFICATION DIVISION.
       PROGRAM-ID. EXPDEDUP.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT SORT-FILE ASSIGN TO SORTWK.
           SELECT TRANS-IN ASSIGN TO TRANSIN
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-IN.
           SELECT CLEAN-OUT ASSIGN TO CLEANOUT
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-CLEAN.
           SELECT DUPS-OUT ASSIGN TO DUPSOUT
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-DUPS.
       DATA DIVISION.
       FILE SECTION.
       SD  SORT-FILE.
       01  SORT-REC.
           05 SR-ID            PIC X(12).
           05 SR-EMP           PIC X(08).
           05 SR-REST          PIC X(60).
       FD  TRANS-IN RECORDING MODE F.
       01  TRANS-REC           PIC X(80).
       FD  CLEAN-OUT RECORDING MODE F.
       01  CLEAN-REC           PIC X(80).
       FD  DUPS-OUT RECORDING MODE F.
       01  DUPS-REC            PIC X(80).
       WORKING-STORAGE SECTION.
       01  FS-IN               PIC XX.
       01  FS-CLEAN            PIC XX.
       01  FS-DUPS             PIC XX.
       01  SORT-EOF            PIC X VALUE 'N'.
           88 SORT-DONE        VALUE 'Y'.
       01  HAVE-PREV           PIC X VALUE 'N'.
       01  WS-CUR              PIC X(80).
       01  WS-PREV             PIC X(80).
       01  CNT-CLEAN           PIC 9(06) VALUE 0.
       01  CNT-DUPS            PIC 9(06) VALUE 0.
       PROCEDURE DIVISION.
       MAIN-PARA.
           OPEN OUTPUT CLEAN-OUT DUPS-OUT
           IF FS-CLEAN NOT = '00' OR FS-DUPS NOT = '00'
              DISPLAY 'OPEN ERROR ' FS-CLEAN ' ' FS-DUPS
              MOVE 12 TO RETURN-CODE
              GOBACK
           END-IF
           SORT SORT-FILE
                ON ASCENDING KEY SR-EMP
                ON ASCENDING KEY SR-ID
                ON ASCENDING KEY SR-REST
                USING TRANS-IN
                OUTPUT PROCEDURE IS WRITE-OUTPUT
           IF SORT-RETURN NOT = 0
              DISPLAY 'SORT FAILED RC=' SORT-RETURN
              MOVE 12 TO RETURN-CODE
           END-IF
           CLOSE CLEAN-OUT DUPS-OUT
           DISPLAY 'UNIQUE RECORDS   : ' CNT-CLEAN
           DISPLAY 'DUPLICATES REMOVED: ' CNT-DUPS
           GOBACK.
       WRITE-OUTPUT.
           PERFORM UNTIL SORT-DONE
              RETURN SORT-FILE INTO WS-CUR
                 AT END SET SORT-DONE TO TRUE
                 NOT AT END PERFORM EMIT-RECORD
              END-RETURN
           END-PERFORM.
       EMIT-RECORD.
           IF HAVE-PREV = 'Y' AND WS-CUR = WS-PREV
              WRITE DUPS-REC FROM WS-CUR
              ADD 1 TO CNT-DUPS
           ELSE
              WRITE CLEAN-REC FROM WS-CUR
              ADD 1 TO CNT-CLEAN
              MOVE WS-CUR TO WS-PREV
              MOVE 'Y' TO HAVE-PREV
           END-IF.
