'use strict';
// Compiles every COBOL program in /mainframe into /bin using GnuCOBOL (cobc).
//   npm run build:cobol
const cobol = require('../lib/cobol');
(async () => {
  const info = await cobol.compilerInfo();
  if (!info.available) { console.error('ERROR: ' + info.reason); process.exit(1); }
  console.log('Compiler: ' + info.version);
  try {
    const log = await cobol.build({ force: true });
    log.forEach(x => console.log(`  ${x.program.padEnd(10)} ${x.status}`));
    console.log('Build complete: executables are in ./bin');
  } catch (e) { console.error(e.message); process.exit(1); }
})();
