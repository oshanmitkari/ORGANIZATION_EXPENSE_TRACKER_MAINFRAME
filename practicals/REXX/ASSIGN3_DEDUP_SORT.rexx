/* REXX TSO/E utility: exact de-duplication and sort for 100-byte records. */
/* Assignment 3: 120 x 100-byte -> 105 unique records */
/* Key at columns 25-32 (1-based) = EXT-EMP-ID per EXPENSE-EXT-REC.cpy */
/* Preserves all 100 bytes, sorts ascending by key using merge sort (O(n log n)) */
/* Reports records read / duplicates removed / written */
/* Exit non-zero unless exactly 105 records written */

/* ===== CONFIGURATION PARAMETERS ===== */
inLrecl  = 100                    /* Input record length */
outLrecl = 100                    /* Output record length */
keyStart = 25                     /* Key start column (1-based) */
keyLen   = 8                      /* Key length */
expectedOut = 105                 /* Expected output count for validation */
/* ====================================== */

address TSO

/* Dataset names - configurable via HLQ */
parse arg inDsn outDsn
if inDsn = '' then inDsn  = userid() || '.EXPENSE.TRANS100'
if outDsn = '' then outDsn = userid() || '.EXPENSE.CLEAN100'

"ALLOC FI(IN) DA('"inDsn"') SHR REUSE"
if rc <> 0 then do
  say 'ERROR: unable to allocate input dataset ' inDsn ' RC=' rc
  exit 12
end

"EXECIO * DISKR IN (STEM r. FINIS"
inRc = rc
"FREE FI(IN)"
if inRc <> 0 then do
  say 'ERROR: EXECIO read failed RC=' inRc
  exit 12
end

say 'Input records read: ' r.0

/* Validate record lengths */
do i = 1 to r.0
  if length(r.i) <> inLrecl then do
    say 'ERROR: input record' i 'has length' length(r.i) '; expected' inLrecl
    exit 12
  end
end

/* Exact de-duplication: preserve first occurrence of each full record */
seen. = 0
u. = ''
n = 0
do i = 1 to r.0
  rec = r.i
  /* Use full record as key for exact dedupe */
  if seen.rec = 0 then do
    seen.rec = 1
    n = n + 1
    u.n = rec
  end
end

dupCount = r.0 - n
say 'Duplicates removed: ' dupCount
say 'Unique records:     ' n

/* Merge sort by key (columns keyStart to keyStart+keyLen-1) */
/* Using iterative bottom-up merge sort for O(n log n) */
gap = 1
do while gap < n
  gap = gap * 2
end

/* Iterative merge sort */
width = 1
do while width < n
  left = 1
  do while left <= n
    mid = left + width - 1
    if mid >= n then leave
    right = mid + width
    if right > n + 1 then right = n + 1

    /* Merge u[left..mid-1] and u[mid..right-1] into temp */
    i = left
    j = mid
    k = left
    do while i < mid & j < right
      keyI = substr(u.i, keyStart, keyLen)
      keyJ = substr(u.j, keyStart, keyLen)
      if keyI <= keyJ then do
        temp.k = u.i
        i = i + 1
      end
      else do
        temp.k = u.j
        j = j + 1
      end
      k = k + 1
    end
    do while i < mid
      temp.k = u.i
      i = i + 1
      k = k + 1
    end
    do while j < right
      temp.k = u.j
      j = j + 1
      k = k + 1
    end
    /* Copy back */
    do m = left to right - 1
      u.m = temp.m
    end

    left = left + 2 * width
  end
  width = width * 2
end

/* Allocate output dataset */
allocCmd = "ALLOC FI(OUT) DA('"outDsn"') NEW CATALOG" ||,
           " RECFM(F B) LRECL("outLrecl") BLKSIZE(0)" ||,
           " SPACE(5 5) TRACKS"
allocCmd
if rc <> 0 then do
  say 'ERROR: unable to allocate output dataset ' outDsn ' RC=' rc
  exit 12
end

"EXECIO " n " DISKW OUT (STEM u. FINIS"
outRc = rc
"FREE FI(OUT)"
if outRc <> 0 then do
  say 'ERROR: EXECIO write failed RC=' outRc
  exit 12
end

say 'Output records written: ' n

/* Validation: exit non-zero unless exactly expectedOut records */
if n <> expectedOut then do
  say 'VALIDATION FAILED: expected' expectedOut 'records, got' n
  exit 8
end

say 'VALIDATION PASSED: output count matches expected'
exit 0