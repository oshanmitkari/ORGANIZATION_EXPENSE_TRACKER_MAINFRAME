/* REXX TSO/E utility: exact de-duplication by employee ID. */
address TSO
inDsn  = userid() || '.EXPENSE.TRANS'
outDsn = userid() || '.EXPENSE.CLEAN'
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
seen. = 0
n = 0
do i = 1 to r.0
  rec = r.i
  if length(rec) <> 80 then do
    say 'ERROR: input record' i 'has length' length(rec) '; expected 80'
    exit 12
  end
  /* Prefix key to avoid compound-stem ambiguity. */
  token = 'K' || rec
  if seen.token = 0 then do
    seen.token = 1
    n = n + 1
    u.n = rec
  end
end
/* Shell sort by employee ID, then full record. */
gap = n % 2
do while gap > 0
  do i = gap + 1 to n
    t = u.i
    j = i
    do while j > gap
      k = j - gap
      if (substr(u.k,13,8) || u.k) <= (substr(t,13,8) || t) then leave
      u.j = u.k
      j = k
    end
    u.j = t
  end
  gap = gap % 2
end
allocCmd = "ALLOC FI(OUT) DA('"outDsn"') NEW CATALOG" ||,
           " RECFM(F B) LRECL(80) BLKSIZE(0)" ||,
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
say 'Input records  :' r.0
say 'Duplicates cut :' r.0 - n
say 'Output records :' n
exit 0
