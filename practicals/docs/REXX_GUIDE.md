# REXX Guide - TSO/E and Batch Reference

## REXX Basics
- **Interpreted**: No compile step needed
- **Variables**: No declaration, case-insensitive, dynamic typing
- **Stems**: Compound variables (arrays) - `stem.0` = count, `stem.i` = element
- **PARSE**: Powerful string parsing with templates

## Running REXX

### TSO/E Interactive
```
TSO EXEC 'HLQ.REXX.LIB(MYEXEC)'
```

### Batch JCL (IKJEFT01)
```jcl
//REXX EXEC PGM=IKJEFT01
//SYSTSPRT DD SYSOUT=*
//SYSTSIN  DD *
  EXEC 'HLQ.REXX.LIB(MYEXEC)' 'PARM1' 'PARM2'
/*
//SYSEXEC  DD DSN=HLQ.REXX.LIB,DISP=SHR
```

### USS (Unix System Services)
```bash
rexx myexec.rexx arg1 arg2
```

## Stems (Arrays)
```rexx
/* Initialize */
stem. = 0
stem.0 = 5
stem.1 = 'First'
stem.2 = 'Second'

/* Iterate */
do i = 1 to stem.0
  say stem.i
end

/* Compound stems */
stem.key.value = 'data'   /* stem."key".value */
```

## PARSE Templates
```rexx
/* By position */
parse var line 1 id 13 emp 21 date 29 cat 33 amt 42 desc

/* By delimiter */
parse var line id ',' emp ',' date ',' cat ',' amt ',' desc

/* Mixed */
parse var line id 13 emp 21 date 29 cat 33 amt 42 desc

/* UPPER (auto-uppercase) */
parse upper var input cmd arg1 arg2
```

## String Functions
| Function | Example | Result |
|----------|---------|--------|
| `substr(str,start,len)` | `substr('ABCDEF',2,3)` | `'BCD'` |
| `length(str)` | `length('ABC')` | `3` |
| `pos(sub,str)` | `pos('CD','ABCDEF')` | `3` |
| `word(str,n)` | `word('a b c',2)` | `'b'` |
| `words(str)` | `words('a b c')` | `3` |
| `strip(str)` | `strip('  abc  ')` | `'abc'` |
| `translate(str)` | `translate('abc')` | `'ABC'` |
| `verify(str,ref)` | `verify('123','0123456789')` | `0` (all valid) |
| `left(str,n)` | `left('abc',5)` | `'abc  '` |
| `right(str,n)` | `right('abc',5)` | `'  abc'` |
| `center(str,n)` | `center('abc',7)` | `'  abc  '` |

## Control Structures
```rexx
/* IF/THEN/ELSE */
if condition then
  say 'true'
else
  say 'false'

/* SELECT (CASE) */
select
  when rc = 0 then say 'OK'
  when rc = 4 then say 'Warning'
  when rc = 12 then say 'Error'
  otherwise say 'Unknown RC' rc
end

/* DO loops */
do i = 1 to 10
  say i
end

do while condition
  ...
end

do until condition
  ...
end

/* DO with LEAVE/ITERATE */
do i = 1 to 100
  if i = 5 then leave
  if i = 3 then iterate
  say i
end
```

## TSO/E Commands (ADDRESS TSO)
```rexx
address TSO
"ALLOC FI(IN) DA('HLQ.INPUT') SHR REUSE"
"EXECIO * DISKR IN (STEM data. FINIS"
rc = rc
"FREE FI(IN)"

"ALLOC FI(OUT) DA('HLQ.OUTPUT') NEW CATALOG RECFM(F B) LRECL(80) BLKSIZE(0)"
"EXECIO 100 DISKW OUT (STEM data. FINIS"
"FREE FI(OUT)"
```

## EXECIO Patterns
| Operation | Syntax |
|-----------|--------|
| Read all to stem | `EXECIO * DISKR DD (STEM stem. FINIS` |
| Read N records | `EXECIO N DISKR DD (STEM stem. FINIS` |
| Write from stem | `EXECIO N DISKW DD (STEM stem. FINIS` |
| Write all from stem | `EXECIO * DISKW DD (STEM stem. FINIS` |
| Skip records | `EXECIO N DISKR DD (SKIP` |

## Dataset Allocation (TSO)
```rexx
/* Sequential */
"ALLOC FI(DDNAME) DA('HLQ.DATASET') SHR REUSE"
"ALLOC FI(DDNAME) DA('HLQ.DATASET') NEW CATALOG RECFM(F B) LRECL(80) BLKSIZE(0) SPACE(5 5) TRACKS"

/* PDS member */
"ALLOC FI(DDNAME) DA('HLQ.LIB(MEMBER)') SHR"

/* VSAM */
"ALLOC FI(DDNAME) DA('HLQ.KSDS') SHR"
```

## Return Code Handling
```rexx
/* Every TSO command sets RC */
"ALLOC FI(IN) DA('HLQ.INPUT') SHR"
if rc <> 0 then do
  say 'Allocation failed, RC=' rc
  exit 12
end

/* Check after EXECIO */
"EXECIO * DISKR IN (STEM data. FINIS"
if rc <> 0 then do
  say 'Read error, RC=' rc
  exit 12
end

/* Set exit code */
exit 0      /* Success */
exit 4      /* Warning */
exit 8      /* Error */
exit 12     /* Severe error */
```

## TRACE Debugging
```rexx
trace normal      /* Default: errors only */
trace results     /* Show results of expressions */
trace intermediates /* Show all steps */
trace off         /* Disable */
trace ?           /* Interactive pause */
```

## File I/O (USS - not TSO)
```rexx
/* Read file line by line */
call linein 'input.txt'  /* Returns line or '' at EOF */
call lineout 'output.txt', line

/* Or use stream */
call stream 'input.txt', 'C', 'OPEN READ'
do while lines('input.txt') > 0
  line = linein('input.txt')
  ...
end
call stream 'input.txt', 'C', 'CLOSE'
```

## Practical Patterns

### Exact Deduplication
```rexx
seen. = 0
unique.0 = 0
do i = 1 to records.0
  rec = records.i
  if seen.rec = 0 then do
    seen.rec = 1
    unique.0 = unique.0 + 1
    unique.unique.0 = rec
  end
end
```

### Shell Sort (O(n²) worst case)
```rexx
gap = n % 2
do while gap > 0
  do i = gap + 1 to n
    temp = arr.i
    j = i
    do while j > gap
      if arr.j-gap <= temp then leave
      arr.j = arr.j-gap
      j = j - gap
    end
    arr.j = temp
  end
  gap = gap % 2
end
```

### Merge Sort (O(n log n))
```rexx
/* Iterative bottom-up */
width = 1
do while width < n
  left = 1
  do while left <= n
    mid = min(left + width - 1, n)
    right = min(mid + width, n)
    /* merge arr[left..mid] and arr[mid+1..right] */
    left = left + 2 * width
  end
  width = width * 2
end
```

## Common Errors
| Error | Cause | Fix |
|-------|-------|-----|
| `+++ RC=20` | Syntax error | Check PARSE templates, quotes |
| `+++ RC=28` | Command not found | Check ADDRESS environment, SYSEXEC |
| `+++ RC=12` | Allocation failed | Check DSN, DISP, VOL, SPACE |
| `+++ RC=4` | Warning (e.g., dataset exists) | Check DISP=(NEW,...) vs SHR |
| Stem not found | Uninitialized compound | Initialize `stem. = 0` |

## REXX in This Project
- `mainframe/DEDUPSRT.rexx` - 80-byte exact dedupe + shell sort (reference)
- `practicals/REXX/ASSIGN3_DEDUP_SORT.rexx` - 100-byte, merge sort, parameterized
- JCL: `practicals/JCL/ASSIGN3_RUN.jcl` - IKJEFT01 execution
- Fixtures: `practicals/TESTDATA/fixture_c_120_records.txt` (100-byte)
- Validator: `practicals/TESTS/validate-assign3.js` (SIMULATED)

## Key Differences: TSO vs USS
| Feature | TSO/E | USS |
|---------|-------|-----|
| Dataset I/O | ALLOC/EXECIO | linein/lineout, stream |
| DD names | Pre-allocated | Not used |
| File paths | HLQ.DATASET | /u/user/file.txt |
| Execution | IKJEFT01 or TSO prompt | `rexx script.rexx` |