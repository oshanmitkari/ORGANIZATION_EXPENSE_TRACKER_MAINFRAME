'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { makeRecord, makeMaster, masterId, run } = require('./lib/pipeline');
const { workflow, recordBatch, recordSecurityEvent } = require('./lib/workflow');
const auth = require('./lib/auth');
const { createRouter } = require('./routes');

const D = process.env.APP_DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(D, { recursive: true });
const F = name => path.join(D, name);
const rd = name => fs.existsSync(F(name)) ? fs.readFileSync(F(name), 'utf8').split(/\r?\n/).filter(Boolean) : [];
function wr(name, lines) {
  const target = F(name), temp = target + '.' + process.pid + '.' + Date.now() + '.tmp';
  fs.writeFileSync(temp, lines.map(x => x + '\n').join(''), { flag: 'wx' }); fs.renameSync(temp, target);
}
const FILES = ['EXPENSE.TRANS','EXPENSE.DUPS','EXPENSE.CLEAN','EXPENSE.MATCHED','EXPENSE.VALID','EXPENSE.REJECT','EXPENSE.REPORT','EXPENSE.CATEGORY','EXPENSE.MONTHLY','EXPENSE.AUDIT','EXPENSE.CHECKPOINT','EMPLOYEE.MASTER'];
if (!fs.existsSync(F('EMPLOYEE.MASTER'))) wr('EMPLOYEE.MASTER', [
  ['E0001001','Apex Demo Employee 001'],['E0001002','Apex Demo Employee 002'],['E0001003','Apex Demo Employee 003'],['E0001004','Apex Demo Employee 004'],['E0001005','Apex Demo Employee 005'],['E0001006','Apex Demo Employee 006']
].map(([id,name]) => makeMaster(id,name)));
const nextId = () => 'TX26' + String(rd('EXPENSE.TRANS').reduce((m,r)=>Math.max(m,+r.slice(4,12)||0),0)+1).padStart(6,'0');

const send = (res, code, value, type) => {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options':'nosniff' });
  res.end(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
};

const handleApi = createRouter(rd, wr, FILES, nextId, D);

function createServer(){
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
    const url=new URL(req.url,'http://localhost');
    try{if(url.pathname.startsWith('/api/'))return await handleApi(req,res,url);if(req.method!=='GET')return send(res,405,{error:'method not allowed'});res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");return send(res,200,fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8'),'text/html; charset=utf-8');}
    catch(e){return send(res,e.status||400,{error:e.message||'bad request'});}
  });
}
if(require.main===module){const server=createServer();server.listen(process.env.PORT||3000,()=>console.log(`Apex Expense Management on http://localhost:${process.env.PORT||3000}`));}
module.exports={createServer, D};