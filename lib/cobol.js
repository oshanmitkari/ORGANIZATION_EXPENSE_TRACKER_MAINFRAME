'use strict';
// Runs the COBOL programs in /mainframe as real operating-system processes (GnuCOBOL).
//
// Flow of one batch run (same order as mainframe/EXPPIPE.jcl):
//   ingest check (Node) -> EXPDEDUP -> MATCH2 -> EXPVALID -> EXPTOTAL -> EXPRPT -> CNTCHECK
//
// Each COBOL program reads/writes fixed-length 80-byte records through DD names
// (environment variables DD_<name>), exactly like the JCL DD statements on z/OS.
// The web app keeps its datasets as one-record-per-line text files, so this module
// converts lines <-> fixed-length records around every run (no newline bytes in COBOL files).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'mainframe');
const BIN_DIR = path.join(ROOT, 'bin');
const WIN = process.platform === 'win32';
const COBC = process.env.COBC_PATH || 'cobc';
const PROGRAMS = ['EXPDEDUP', 'MATCH2', 'EXPVALID', 'EXPTOTAL', 'EXPRPT', 'CNTCHECK'];
const STEP_TIMEOUT_MS = 30000;

const exePath = name => path.join(BIN_DIR, name + (WIN ? '.exe' : ''));
const srcPath = name => path.join(SRC_DIR, name + '.cbl');
const pad = (s, n) => String(s == null ? '' : s).slice(0, n).padEnd(n, ' ');

class CobolError extends Error {
  constructor(message, status = 500, steps = []) { super(message); this.status = status; this.steps = steps; }
}

// Promise wrapper around execFile that never throws on a non-zero exit code
// (COBOL return codes 4 and 12 are meaningful results, not crashes).
function exec(file, args, opts = {}) {
  return new Promise(resolve => {
    execFile(file, args, { timeout: STEP_TIMEOUT_MS, windowsHide: true, maxBuffer: 8 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err && err.code === 'ENOENT') return resolve({ rc: null, missing: true, stdout: '', stderr: String(err.message) });
      const rc = err ? (typeof err.code === 'number' ? err.code : (err.killed ? 'TIMEOUT' : 'ABEND')) : 0;
      resolve({ rc, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

// ---------- compiler detection and build ----------
let infoCache = null;
async function compilerInfo(force = false) {
  if (infoCache && !force) return infoCache;
  const r = await exec(COBC, ['--version']);
  infoCache = r.missing || r.rc !== 0
    ? { available: false, compiler: COBC, version: null, reason: `COBOL compiler '${COBC}' was not found. Install GnuCOBOL (see README) or set COBC_PATH.` }
    : { available: true, compiler: COBC, version: (r.stdout.split(/\r?\n/)[0] || '').trim() };
  return infoCache;
}

const isBuilt = name => fs.existsSync(exePath(name)) && fs.statSync(exePath(name)).mtimeMs >= fs.statSync(srcPath(name)).mtimeMs;

async function build({ force = false } = {}) {
  const info = await compilerInfo();
  if (!info.available) throw new CobolError(info.reason, 503);
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const log = [];
  for (const name of PROGRAMS) {
    if (!force && isBuilt(name)) { log.push({ program: name, status: 'up to date' }); continue; }
    const r = await exec(COBC, ['-x', '-o', exePath(name), srcPath(name)], { cwd: SRC_DIR });
    if (r.rc !== 0) throw new CobolError(`Compilation of ${name}.cbl failed (rc=${r.rc}):\n${(r.stderr || r.stdout).trim()}`, 500);
    log.push({ program: name, status: 'compiled' });
  }
  return log;
}

let buildPromise = null;
function ensureBuilt() {
  if (PROGRAMS.every(isBuilt) && infoCache && infoCache.available) return Promise.resolve([]);
  if (!buildPromise) buildPromise = build().finally(() => { buildPromise = null; });
  return buildPromise;
}

async function status() {
  const info = await compilerInfo();
  return {
    engine: 'COBOL', ...info, platform: process.platform,
    programs: PROGRAMS.map(name => ({ name, source: `mainframe/${name}.cbl`, built: fs.existsSync(exePath(name)) && isBuilt(name) }))
  };
}

// ---------- fixed-length record conversion (RECFM=FB) ----------
const toFixed = (lines, lrecl) => Buffer.from(lines.map(l => pad(l, lrecl)).join(''), 'latin1');
function fromFixed(buf, lrecl, name) {
  if (buf.length % lrecl) throw new CobolError(`${name} is ${buf.length} bytes, not a multiple of LRECL ${lrecl}`);
  const s = buf.toString('latin1'), out = [];
  for (let i = 0; i < s.length; i += lrecl) out.push(s.slice(i, i + lrecl));
  return out;
}

// ---------- the batch ----------
async function runCobolPipeline(trans, master, breakCount = false) {
  await ensureBuilt();
  const info = await compilerInfo();
  const started = Date.now();

  // Ingest check (what the upload route and JCL allocation enforce): exactly 80 printable single-byte characters.
  const malformed = [], safeTrans = [];
  for (const source of trans) {
    const raw = String(source).replace(/[\r\n]/g, '');
    if (Buffer.byteLength(raw, 'utf8') !== 80 || /[^\x20-\x7E]/.test(raw))
      malformed.push([raw.slice(0, 80).padEnd(80, ' '), 'record length/encoding invalid; expected 80 single-byte printable characters']);
    else safeTrans.push(raw);
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'expbatch-'));
  const f = n => path.join(work, n);
  const steps = [{ step: 'STEP00', program: 'INGEST (Node)', rc: 0, ms: 0, stdout: `READ ${trans.length} MALFORMED ${malformed.length}` }];

  const runStep = async (program, dd, extraEnv = {}) => {
    const t0 = Date.now(), env = { ...process.env, TMPDIR: work, TMP: work, TEMP: work, ...extraEnv };
    for (const [k, v] of Object.entries(dd)) env['DD_' + k] = f(v);
    const r = await exec(exePath(program), [], { env, cwd: work });
    const rec = {
      step: 'STEP' + String(steps.length).padStart(2, '0'), program, rc: r.rc, ms: Date.now() - t0,
      dd: Object.fromEntries(Object.entries(dd).map(([k, v]) => [k, v])), stdout: (r.stdout + r.stderr).trim()
    };
    steps.push(rec);
    return rec;
  };
  const mustRun = async (program, dd, extraEnv) => {
    const rec = await runStep(program, dd, extraEnv);
    if (rec.rc === null || typeof rec.rc !== 'number' || rec.rc >= 12)
      throw new CobolError(`${program} ended with return code ${rec.rc}: ${rec.stdout || 'no output'}`, 500, steps);
    return rec;
  };

  try {
    fs.writeFileSync(f('TRANS.dat'), toFixed(safeTrans, 80));
    fs.writeFileSync(f('MASTER.dat'), toFixed(master, 80));
    for (const n of ['CLEAN', 'DUPS', 'MATCHED', 'UNKNOWN', 'VALID', 'REJECT', 'REPORT', 'CATEGORY', 'MONTHLY']) fs.writeFileSync(f(n + '.dat'), '');

    await mustRun('EXPDEDUP', { TRANSIN: 'TRANS.dat', CLEANOUT: 'CLEAN.dat', DUPSOUT: 'DUPS.dat' });
    await mustRun('MATCH2', { FILE1: 'CLEAN.dat', FILE2: 'MASTER.dat', FILE3: 'MATCHED.dat', FILE4: 'UNKNOWN.dat' });
    await mustRun('EXPVALID', { TRANSIN: 'MATCHED.dat', GOODOUT: 'VALID.dat', REJOUT: 'REJECT.dat' });
    await mustRun('EXPTOTAL', { INFILE: 'VALID.dat', CATOUT: 'CATEGORY.dat', MONOUT: 'MONTHLY.dat' });
    await mustRun('EXPRPT', { INFILE: 'VALID.dat', OUTFILE: 'REPORT.dat' }, { BREAK_COUNT: breakCount ? 'Y' : 'N' });
    const chk = await runStep('CNTCHECK', { INFILE: 'VALID.dat', OUTFILE: 'REPORT.dat' });
    const countOk = chk.rc === 0;
    if (!countOk && !(chk.rc === 12 && /COUNT CHECK FAILED/.test(chk.stdout)))
      throw new CobolError(`CNTCHECK ended with return code ${chk.rc}: ${chk.stdout || 'no output'}`, 500, steps);

    const read = (n, l) => fromFixed(fs.readFileSync(f(n + '.dat')), l, n);
    const clean = read('CLEAN', 80), dups = read('DUPS', 80), matched = read('MATCHED', 80), valid = read('VALID', 80);
    const unknown = read('UNKNOWN', 110).map(x => [x.slice(0, 80), x.slice(80).trim()]);
    const rejected = read('REJECT', 110).map(x => [x.slice(0, 80), x.slice(80).trim()]);
    const report = read('REPORT', 80), categoryReport = read('CATEGORY', 80), monthlyReport = read('MONTHLY', 80);
    const exceptions = malformed.concat(unknown, rejected).map(([r, why]) => pad(r, 80) + pad(why, 30));
    const rc = countOk ? (exceptions.length ? 4 : 0) : 12;

    const checkpoints = [
      `01 INPUT_READ COMPLETE COUNT=${trans.length} MALFORMED=${malformed.length}`, `02 DEDUPLICATION COMPLETE COUNT=${clean.length}`,
      `03 EMPLOYEE_MATCH COMPLETE MATCHED=${matched.length} UNKNOWN=${unknown.length}`,
      `04 VALIDATION COMPLETE APPROVED=${valid.length} REJECTED=${rejected.length}`,
      `05 REPORT_SORT COMPLETE COUNT=${report.length}`, `06 COUNT_CHECK ${countOk ? 'PASS' : 'FAIL'}`
    ].map(s => pad(s, 80));
    const audit = [
      `RAW=${trans.length}`, `MALFORMED=${malformed.length}`, `DUPLICATES=${dups.length}`, `CLEAN=${clean.length}`,
      `UNKNOWN_EMPLOYEE=${unknown.length}`, `VALIDATION_REJECTED=${rejected.length}`, `APPROVED=${valid.length}`,
      `REPORT_BEFORE=${valid.length}`, `REPORT_AFTER=${report.length}`, `COUNT_CHECK=${countOk ? 'PASS' : 'FAIL'}`,
      `RETURN_CODE=${rc}`, `ENGINE=${info.version || 'GnuCOBOL'}`
    ].map(s => pad(s, 80));

    const result = {
      engine: 'COBOL', compiler: info.version, raw: trans.length, malformed, dups, clean, unknown, matched, valid, rejected, report,
      categoryReport, monthlyReport, exceptions, audit, checkpoints, countBefore: valid.length, countAfter: report.length, countOk, rc, steps,
      durationMs: Date.now() - started
    };
    result.jobLog = formatJobLog(result);
    return result;
  } catch (e) {
    if (e instanceof CobolError) { if (!e.steps.length) e.steps = steps; throw e; }
    throw new CobolError(`COBOL batch failed: ${e.message}`, 500, steps);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

function formatJobLog(r) {
  const out = [`JOB EXPBATCH  engine=${r.compiler || 'GnuCOBOL'}  duration=${r.durationMs} ms`, ''];
  for (const s of r.steps) {
    const rc = typeof s.rc === 'number' ? String(s.rc).padStart(4, '0') : String(s.rc);
    out.push(`${s.step}  ${pad(s.program, 14)} RC=${rc}`);
    if (s.dd) out.push('        DD: ' + Object.entries(s.dd).map(([k, v]) => `${k}=${v}`).join(' '));
    for (const line of String(s.stdout || '').split(/\r?\n/).filter(Boolean)) out.push('        ' + line);
  }
  out.push('', `FINAL RC=${String(r.rc).padStart(4, '0')}  COUNT CHECK ${r.countOk ? 'PASSED' : 'FAILED'}`);
  return out.join('\n');
}

module.exports = { PROGRAMS, CobolError, compilerInfo, build, status, runCobolPipeline, toFixed, fromFixed };
