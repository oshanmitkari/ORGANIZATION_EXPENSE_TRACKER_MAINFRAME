      * EXPTOTAL - category and monthly totals of validated records.
      * Output record (80 bytes): label X(32), total cents 9(12),
      * record count 9(08), filler X(28), sorted by label.
      * DDs: INFILE (valid records), CATOUT, MONOUT
       IDENTIFICATION DIVISION.
       PROGRAM-ID. EXPTOTAL.
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT IN-FILE ASSIGN TO INFILE
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-IN.
           SELECT CAT-OUT ASSIGN TO CATOUT
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-CAT.
           SELECT MON-OUT ASSIGN TO MONOUT
               ORGANIZATION IS SEQUENTIAL
               FILE STATUS IS FS-MON.
       DATA DIVISION.
       FILE SECTION.
       FD  IN-FILE RECORDING MODE F.
       01  IN-REC.
           05 IN-ID            PIC X(12).
           05 IN-EMP           PIC X(08).
           05 IN-DATE          PIC X(08).
           05 IN-CAT           PIC X(04).
           05 IN-AMT           PIC 9(09).
           05 IN-DESC          PIC X(39).
       FD  CAT-OUT RECORDING MODE F.
       01  CAT-REC             PIC X(80).
       FD  MON-OUT RECORDING MODE F.
       01  MON-REC             PIC X(80).
       WORKING-STORAGE SECTION.
       01  FS-IN               PIC XX.
       01  FS-CAT              PIC XX.
       01  FS-MON              PIC XX.
       01  EOF-SW              PIC X VALUE 'N'.
           88 AT-EOF           VALUE 'Y'.
       01  CAT-N               PIC 9(04) VALUE 0.
       01  MON-N               PIC 9(04) VALUE 0.
       01  CAT-TABLE.
           05 CAT-ENTRY OCCURS 50 TIMES.
              10 CT-KEY        PIC X(04).
              10 CT-SUM        PIC 9(12).
              10 CT-CNT        PIC 9(08).
       01  MON-TABLE.
           05 MON-ENTRY OCCURS 600 TIMES.
              10 MT-KEY        PIC X(06).
              10 MT-SUM        PIC 9(12).
              10 MT-CNT        PIC 9(08).
       01  I                   PIC 9(04).
       01  J                   PIC 9(04).
       01  SLOT                 PIC 9(04).
       01  WS-MONTH            PIC X(06).
       01  OUT-LINE.
           05 OL-LABEL         PIC X(32).
           05 OL-SUM           PIC 9(12).
           05 OL-CNT           PIC 9(08).
           05 FILLER           PIC X(28) VALUE SPACES.
       PROCEDURE DIVISION.
       MAIN-PARA.
           OPEN INPUT IN-FILE OUTPUT CAT-OUT MON-OUT
           IF FS-IN NOT = '00' OR FS-CAT NOT = '00'
              OR FS-MON NOT = '00'
              DISPLAY 'OPEN ERROR ' FS-IN ' ' FS-CAT ' ' FS-MON
              MOVE 12 TO RETURN-CODE
              GOBACK
           END-IF
           PERFORM UNTIL AT-EOF OR RETURN-CODE = 12
              READ IN-FILE
              EVALUATE FS-IN
                WHEN '10' SET AT-EOF TO TRUE
                WHEN '00' PERFORM ACCUMULATE
                WHEN OTHER
                  DISPLAY 'INPUT READ ERROR ' FS-IN
                  MOVE 12 TO RETURN-CODE
              END-EVALUATE
           END-PERFORM
           IF RETURN-CODE NOT = 12
              PERFORM VARYING I FROM 1 BY 1 UNTIL I > CAT-N
                 MOVE SPACES TO OL-LABEL
                 STRING 'CATEGORY ' CT-KEY(I) DELIMITED BY SIZE
                        INTO OL-LABEL
                 MOVE CT-SUM(I) TO OL-SUM
                 MOVE CT-CNT(I) TO OL-CNT
                 WRITE CAT-REC FROM OUT-LINE
              END-PERFORM
              PERFORM VARYING I FROM 1 BY 1 UNTIL I > MON-N
                 MOVE SPACES TO OL-LABEL
                 STRING 'MONTH ' MT-KEY(I) DELIMITED BY SIZE
                        INTO OL-LABEL
                 MOVE MT-SUM(I) TO OL-SUM
                 MOVE MT-CNT(I) TO OL-CNT
                 WRITE MON-REC FROM OUT-LINE
              END-PERFORM
           END-IF
           CLOSE IN-FILE CAT-OUT MON-OUT
           DISPLAY 'CATEGORIES: ' CAT-N ' MONTHS: ' MON-N
           GOBACK.
       ACCUMULATE.
      *    Category table, kept in ascending key order.
           MOVE 0 TO SLOT
           PERFORM VARYING I FROM 1 BY 1 UNTIL I > CAT-N OR SLOT > 0
              IF CT-KEY(I) = IN-CAT MOVE I TO SLOT END-IF
           END-PERFORM
           IF SLOT = 0
              IF CAT-N >= 50
                 DISPLAY 'CATEGORY TABLE FULL'
                 MOVE 12 TO RETURN-CODE
              ELSE
                 MOVE CAT-N TO J
                 PERFORM UNTIL J < 1 OR CT-KEY(J) <= IN-CAT
                    MOVE CAT-ENTRY(J) TO CAT-ENTRY(J + 1)
                    SUBTRACT 1 FROM J
                 END-PERFORM
                 COMPUTE SLOT = J + 1
                 MOVE IN-CAT TO CT-KEY(SLOT)
                 MOVE 0 TO CT-SUM(SLOT) CT-CNT(SLOT)
                 ADD 1 TO CAT-N
              END-IF
           END-IF
           IF RETURN-CODE NOT = 12
              ADD IN-AMT TO CT-SUM(SLOT)
              ADD 1 TO CT-CNT(SLOT)
      *       Month table (YYYYMM), kept in ascending key order.
              MOVE IN-DATE(1:6) TO WS-MONTH
              MOVE 0 TO SLOT
              PERFORM VARYING I FROM 1 BY 1
                      UNTIL I > MON-N OR SLOT > 0
                 IF MT-KEY(I) = WS-MONTH MOVE I TO SLOT END-IF
              END-PERFORM
              IF SLOT = 0
                 IF MON-N >= 600
                    DISPLAY 'MONTH TABLE FULL'
                    MOVE 12 TO RETURN-CODE
                 ELSE
                    MOVE MON-N TO J
                    PERFORM UNTIL J < 1 OR MT-KEY(J) <= WS-MONTH
                       MOVE MON-ENTRY(J) TO MON-ENTRY(J + 1)
                       SUBTRACT 1 FROM J
                    END-PERFORM
                    COMPUTE SLOT = J + 1
                    MOVE WS-MONTH TO MT-KEY(SLOT)
                    MOVE 0 TO MT-SUM(SLOT) MT-CNT(SLOT)
                    ADD 1 TO MON-N
                 END-IF
              END-IF
              IF RETURN-CODE NOT = 12
                 ADD IN-AMT TO MT-SUM(SLOT)
                 ADD 1 TO MT-CNT(SLOT)
              END-IF
           END-IF.
