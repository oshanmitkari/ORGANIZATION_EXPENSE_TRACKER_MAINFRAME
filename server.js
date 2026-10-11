'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { makeRecord, makeMaster, masterId, run } = require('./lib/pipeline');
const { workflow, recordBatch, recordSecurityEvent } = require('./lib/workflow');
const auth = require('./lib/auth');

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
const readBody = req => new Promise((resolve,reject)=>{
  let raw=''; req.on('data',chunk=>{raw+=chunk; if(raw.length>1_000_000){reject(Object.assign(new Error('Request body too large'),{status:413}));req.destroy();}});
  req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch{reject(Object.assign(new Error('Invalid JSON body'),{status:400}));}});
});
const SAMPLE = [
  ['E0001001','20261001','FOOD',1250.5,'Client lunch'],['E0001002','20261002','TRVL',3400,'Cab to site'],['E0001003','20261002','OFFC',899,'Printer toner'],
  ['E0001004','20261003','MEDC',640,'Pharmacy'],['E0001005','20261004','UTIL',2100,'Electricity share'],['E0001006','20261005','TRNG',7500,'Training fee'],
  ['E0001001','20261006','TRVL',5200,'Train tickets'],['E0001002','20261007','FOOD',380,'Team snacks'],['E9999001','20261003','FOOD',450,'Unknown employee'],
  ['E0001003','20261341','OFFC',899,'Bad date'],['E0001005','20261004','XXXX',250,'Bad category'],['E0001002','20261006','UTIL',0,'Zero amount']
];

function requiredPermission(req, actor) {
  const p=req.url.split('?')[0], m=req.method;
  if (p==='/api/enterprise' && m==='GET') return ({EMPLOYEE:'expense:read_own',MANAGER:'expense:read_team',FINANCE_OPERATOR:'expense:read_all',FINANCE_ADMIN:'expense:read_all',AUDITOR:'expense:read_all'})[actor.role];
  if (p==='/api/dashboard' && m==='GET') return ({EMPLOYEE:'report:read_own',MANAGER:'report:read_team',FINANCE_OPERATOR:'report:read',FINANCE_ADMIN:'report:read',AUDITOR:'report:read'})[actor.role];
  if (p==='/api/reports' && m==='GET') return ({EMPLOYEE:'report:read_own',MANAGER:'report:read_team',FINANCE_OPERATOR:'report:read',FINANCE_ADMIN:'report:read',AUDITOR:'report:read'})[actor.role];
  if (p==='/api/audit' && m==='GET') return 'audit:read';
  if (p==='/api/expenses' && m==='POST') return 'expense:create';
  if (p==='/api/employees' && m==='POST') return 'employee:manage';
  if (p==='/api/run' && m==='POST') return 'batch:execute';
  if (p==='/api/upload' && m==='POST' || p==='/api/sample' && m==='POST' || p==='/api/transactions' && (m==='POST'||m==='DELETE')) return 'batch:execute';
  if (p==='/api/transactions' && m==='GET' || p==='/api/state' && m==='GET' || p.startsWith('/api/file/') && m==='GET') return 'batch:read';
  if (p==='/api/master' && m==='POST') return 'employee:manage';
  const e=p.match(/^\/api\/expenses\/[^/]+(?:\/(submit|approve|reject|post))?$/);
  if(e){switch(e[1]){case 'submit':return 'expense:submit';case 'approve':return 'expense:approve_assigned';case 'reject':return 'expense:reject_assigned';case 'post':return 'expense:post';default:if(m==='PATCH')return ['FINANCE_OPERATOR','FINANCE_ADMIN'].includes(actor.role)?'expense:update_all_draft':'expense:update_own_draft';if(m==='GET')return ({EMPLOYEE:'expense:read_own',MANAGER:'expense:read_team',FINANCE_OPERATOR:'expense:read_all',FINANCE_ADMIN:'expense:read_all',AUDITOR:'expense:read_all'})[actor.role];}}
  return null;
}
function loginRateLimit() {
  const attempts=new Map(), windowMs=10*60*1000;
  return {blocked(ip){const now=Date.now(),recent=(attempts.get(ip)||[]).filter(t=>now-t<windowMs);attempts.set(ip,recent);return recent.length>=10;},failed(ip){const now=Date.now(),recent=(attempts.get(ip)||[]).filter(t=>now-t<windowMs);recent.push(now);attempts.set(ip,recent);},clear(ip){attempts.delete(ip);}};
}
const loginLimiter=loginRateLimit();
function sameOrigin(req) {
  const origin=req.headers.origin; if(!origin)return true;
  try { const u=new URL(origin); return u.host===req.headers.host && ['http:','https:'].includes(u.protocol); } catch { return false; }
}

async function handleApi(req,res,url) {
  const p=url.pathname, m=req.method, secure=!!req.socket.encrypted || process.env.NODE_ENV==='production';
  if(p==='/api/auth/session'&&m==='GET') return send(res,200,{user:auth.actorPayload(auth.currentActor(req))});
  if(p==='/api/auth/login'&&m==='POST'){
    if(!sameOrigin(req))return send(res,403,{error:'Origin rejected'});
    const ip=req.socket.remoteAddress||'unknown';if(loginLimiter.blocked(ip))return send(res,429,{error:'Too many failed login attempts; wait ten minutes'});
    const data=await readBody(req), actor=await auth.login(data.username,data.password,res,secure);
    if(!actor){loginLimiter.failed(ip);recordSecurityEvent('LOGIN_FAILURE',String(data.username||'').slice(0,80),'DENIED');return send(res,401,{error:'Invalid username or password, or demo accounts are not configured'});}
    loginLimiter.clear(ip);
    return send(res,200,{user:auth.actorPayload(actor)});
  }
  if(p==='/api/auth/logout'&&m==='POST'){
    if(!sameOrigin(req))return send(res,403,{error:'Origin rejected'});
    auth.logout(req,res,secure);return send(res,200,{ok:true});
  }
  const actor=auth.currentActor(req);
  if(!actor)return send(res,401,{error:'Authentication required'});
  if(!sameOrigin(req)){recordSecurityEvent('CSRF_ORIGIN_REJECT',p,'DENIED');return send(res,403,{error:'Origin rejected'});}
  const permission=requiredPermission(req,actor);
  if(permission){
    try{auth.requirePermission(actor,permission);}catch(e){recordSecurityEvent('AUTHZ_DENIED',`${actor.username}:${m} ${p}`,'DENIED');return send(res,e.status,e);}
  } else if (p.startsWith('/api/')) return send(res,404,{error:'not found'});

  if(p==='/api/enterprise'||p==='/api/dashboard'||p==='/api/reports'||p==='/api/audit'||p==='/api/expenses'||p==='/api/employees'||p.startsWith('/api/expenses/')){
    const data=['POST','PATCH'].includes(m)?await readBody(req):{};
    try { const result=workflow(actor,{pathname:p,method:m},data); if(result!==null)return send(res,m==='POST'&&(p==='/api/expenses'||p==='/api/employees')?201:200,result); }
    catch(e){if(e.status===403)recordSecurityEvent('OBJECT_ACCESS_DENIED',`${actor.username}:${m} ${p}`,'DENIED');return send(res,e.status||400,{error:e.message||'request failed'});}
  }
  if(m==='GET'&&p==='/api/state')return send(res,200,{trans:rd('EXPENSE.TRANS'),master:rd('EMPLOYEE.MASTER'),files:FILES.filter(f=>fs.existsSync(F(f)))});
  if(m==='POST'&&p==='/api/transactions'){
    const b=await readBody(req); if(!b.emp||!b.date||!b.cat||b.amount===''||b.amount==null)return send(res,400,{error:'emp, date, cat and amount are required'});
    const rec=makeRecord({...b,id:nextId()});wr('EXPENSE.TRANS',rd('EXPENSE.TRANS').concat(rec));return send(res,201,{record:rec});
  }
  if(m==='POST'&&p==='/api/upload'){
    const b=await readBody(req), lines=String(b.text||'').replace(/\r/g,'').split('\n').filter(x=>x.length);
    if(lines.some(x=>Buffer.byteLength(x,'utf8')!==80||/[^\x20-\x7E]/.test(x)))return send(res,400,{error:'Every input record must be exactly 80 single-byte printable characters; no records were appended.'});
    wr('EXPENSE.TRANS',rd('EXPENSE.TRANS').concat(lines));return send(res,201,{added:lines.length});
  }
  if(m==='POST'&&p==='/api/sample'){
    const t=rd('EXPENSE.TRANS'), add=[]; SAMPLE.forEach(([emp,date,cat,amount,desc])=>add.push(makeRecord({id:'TX26'+String(t.length+add.length+1).padStart(6,'0'),emp,date,cat,amount,desc})));add.push(add[0],add[3]);wr('EXPENSE.TRANS',t.concat(add));return send(res,201,{added:add.length});
  }
  if(m==='DELETE'&&p==='/api/transactions'){FILES.filter(x=>x!=='EMPLOYEE.MASTER').forEach(x=>{if(fs.existsSync(F(x)))fs.unlinkSync(F(x));});return send(res,200,{ok:true});}
  if(m==='POST'&&p==='/api/master'){
    const b=await readBody(req);if(!b.id||!b.name)return send(res,400,{error:'id and name are required'});const mm=rd('EMPLOYEE.MASTER');if(mm.some(r=>masterId(r)===String(b.id).trim().toUpperCase()))return send(res,409,{error:'employee already exists'});mm.push(makeMaster(b.id,b.name));wr('EMPLOYEE.MASTER',mm);return send(res,201,{ok:true});
  }
  if(m==='POST'&&p==='/api/run'){
    const b=await readBody(req), trans=rd('EXPENSE.TRANS');if(!trans.length)return send(res,400,{error:'EXPENSE.TRANS is empty - add some transactions first'});
    const r=run(trans,rd('EMPLOYEE.MASTER'),!!b.breakCount);wr('EXPENSE.DUPS',r.dups);wr('EXPENSE.CLEAN',r.clean);wr('EXPENSE.MATCHED',r.matched);wr('EXPENSE.VALID',r.valid);wr('EXPENSE.REJECT',r.exceptions);wr('EXPENSE.CATEGORY',r.categoryReport);wr('EXPENSE.MONTHLY',r.monthlyReport);wr('EXPENSE.AUDIT',r.audit);wr('EXPENSE.CHECKPOINT',r.checkpoints);
    if(r.countOk)wr('EXPENSE.REPORT',r.report);else if(fs.existsSync(F('EXPENSE.REPORT')))fs.unlinkSync(F('EXPENSE.REPORT'));
    r.message=r.countOk?`RECORD COUNTS MATCH (${r.countBefore}) - REPORT KEPT`:`ERROR - RECORD COUNT MISMATCH (${r.countBefore} vs ${r.countAfter}) - REPORT DELETED`;
    recordBatch(r,actor);return send(res,200,r);
  }
  const file=p.match(/^\/api\/file\/([A-Z.]+)$/);if(m==='GET'&&file&&FILES.includes(file[1]))return fs.existsSync(F(file[1]))?send(res,200,fs.readFileSync(F(file[1]),'utf8'),'text/plain; charset=utf-8'):send(res,404,{error:'dataset not found'});
  return send(res,404,{error:'not found'});
}

function createServer(){
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
    const url=new URL(req.url,'http://localhost');
    try{if(url.pathname.startsWith('/api/'))return await handleApi(req,res,url);if(req.method!=='GET')return send(res,405,{error:'method not allowed'});res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");return send(res,200,fs.readFileSync(path.join(__dirname,'public','index.html'),'utf8'),'text/html; charset=utf-8');}
    catch(e){return send(res,e.status||400,{error:e.message||'bad request'});}
  });
}
if(require.main===module){const server=createServer();server.listen(process.env.PORT||3000,()=>console.log(`Apex Expense Management on http://localhost:${process.env.PORT||3000}`));}
module.exports={createServer};
