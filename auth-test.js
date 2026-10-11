'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'apex-rbac-'));
  process.env.APP_DATA_DIR = temp;
  const auth = require('./lib/auth');
  const { createServer } = require('./server');
  const definitions = [
    ['employee','EMPLOYEE','E0001002'],['manager','MANAGER','E0001001'],['manager2','MANAGER','E0001006'],
    ['finance','FINANCE_OPERATOR','E0001003'],['admin','FINANCE_ADMIN','E0001004'],['auditor','AUDITOR','E0001005']
  ];
  const users=[];
  for(const [username,role,employeeId] of definitions){const salt=crypto.randomBytes(16).toString('hex');users.push({username,role,employeeId,name:`Test ${username}`,salt,passwordHash:await auth.hash('Test-password-42!',salt)});}
  fs.writeFileSync(auth.USERS_FILE,JSON.stringify(users));
  const server=createServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`, jars={};
  async function call(url,method='GET',data,who,extraHeaders={}){const headers={'content-type':'application/json',...extraHeaders};if(who&&jars[who])headers.cookie=jars[who];const response=await fetch(base+url,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});const cookie=response.headers.get('set-cookie');if(who&&cookie)jars[who]=cookie.split(';')[0];const body=await response.json().catch(()=>null);return {response,body};}
  async function login(name){const r=await call('/api/auth/login','POST',{username:name,password:'Test-password-42!'},name);assert.equal(r.response.status,200,`login ${name}`);assert.ok(jars[name]);return r.body.user;}
  async function expect(status,promise,label){const r=await promise;assert.equal(r.response.status,status,`${label}: ${JSON.stringify(r.body)}`);return r;}
  try {
    await expect(401,call('/api/enterprise'),'anonymous enterprise read');
    await expect(401,call('/api/enterprise','GET',undefined,undefined,{'X-Role':'FINANCE_ADMIN','X-Employee':'E0001004'}),'forged identity headers');
    await expect(401,call('/api/run','POST',{}),'anonymous batch run');
    await expect(401,call('/api/auth/login','POST',{username:'employee',password:'wrong'}),'invalid login');
    for(const [name] of definitions)await login(name);
    assert.deepEqual((await call('/api/auth/session','GET',undefined,'employee')).body.user.permissions,auth.permissions('EMPLOYEE'));

    await expect(403,call('/api/employees','POST',{id:'E0001011',name:'Nope',department:'IT',costCentre:'C-1'},'finance'),'unauthorized employee maintenance');
    const added=await expect(201,call('/api/employees','POST',{id:'E0001010',name:'Test scoped employee',department:'Operations',designation:'Analyst',managerId:'E0001006',costCentre:'ACS-101',role:'FINANCE_ADMIN'},'admin'),'admin employee creation');
    assert.equal(added.body.role,undefined,'caller-supplied role is not persisted');
    const record=await expect(201,call('/api/expenses','POST',{employeeId:'E0001002',date:'2026-09-21',category:'Travel',amount:123.45,description:'RBAC assigned claim'},'finance'),'finance creates claim');
    const own=record.body;
    const scoped=await expect(201,call('/api/expenses','POST',{employeeId:'E0001010',date:'2026-09-22',category:'Meals',amount:50,description:'Unassigned manager claim'},'finance'),'finance creates scoped claim');
    const self=await expect(201,call('/api/expenses','POST',{employeeId:'E0001001',date:'2026-09-23',category:'Travel',amount:25,description:'Self approval check'},'finance'),'finance creates self claim');
    await expect(409,call('/api/expenses','POST',{employeeId:'E0001002',date:'2026-09-21',category:'Travel',amount:123.45,description:'RBAC assigned claim'},'finance'),'duplicate claim rejected');

    await expect(200,call(`/api/expenses/${own.id}`,'GET',undefined,'employee'),'employee reads own claim');
    await expect(403,call(`/api/expenses/${scoped.body.id}`,'GET',undefined,'employee'),'employee IDOR read denied');
    await expect(403,call(`/api/expenses/${scoped.body.id}`,'PATCH',{description:'cross owner edit'},'employee'),'employee IDOR update denied');
    await expect(403,call('/api/expenses','POST',{employeeId:'E0001001',date:'2026-09-20',category:'Travel',amount:9,description:'cross owner create'},'employee'),'employee creates only own');
    await expect(403,call('/api/expenses','POST',{employeeId:'E0001004',date:'2026-09-20',category:'Travel',amount:9,description:'spoof employee id'},'employee',{'X-Employee':'E0001004'}),'employee identity header spoof denied');
    await expect(403,call(`/api/expenses/${own.id}/post`,'POST',{},'employee'),'employee posting denied');
    await expect(403,call(`/api/expenses/${own.id}/approve`,'POST',{},'finance'),'finance operator approval denied');
    await expect(403,call('/api/run','POST',{},'manager'),'manager batch execution denied');
    await expect(403,call('/api/run','POST',{},'employee',{'X-Role':'FINANCE_ADMIN','X-Employee':'E0001004'}),'logged-in role spoof denied');
    await expect(403,call('/api/run','POST',{},'auditor'),'auditor batch execution denied');
    await expect(403,call('/api/expenses','POST',{employeeId:'E0001005',date:'2026-09-20',category:'Travel',amount:9,description:'auditor write'},'auditor'),'auditor expense write denied');
    await expect(403,call('/api/audit','GET',undefined,'employee'),'employee audit denied');
    await expect(404,call('/api/users','POST',{username:'employee',role:'FINANCE_ADMIN'},'admin'),'no public role-management endpoint');

    await expect(200,call(`/api/expenses/${own.id}/submit`,'POST',{},'employee'),'employee submits own claim');
    await expect(403,call(`/api/expenses/${own.id}/approve`,'POST',{},'manager2'),'manager outside assignment denied');
    await expect(200,call(`/api/expenses/${own.id}/approve`,'POST',{comment:'Approved for test'},'manager'),'assigned manager approval');
    await expect(403,call(`/api/expenses/${own.id}/post`,'POST',{},'manager'),'manager posting denied');
    await expect(200,call(`/api/expenses/${own.id}/post`,'POST',{},'finance'),'finance posts approved claim');
    await expect(409,call(`/api/expenses/${own.id}/post`,'POST',{},'finance'),'posting idempotency');

    await expect(200,call(`/api/expenses/${scoped.body.id}/submit`,'POST',{},'finance'),'finance submits scoped test claim');
    await expect(403,call(`/api/expenses/${scoped.body.id}/approve`,'POST',{},'manager'),'manager unassigned approval denied');
    await expect(200,call(`/api/expenses/${scoped.body.id}/approve`,'POST',{},'manager2'),'assigned manager approves scoped claim');
    await expect(200,call(`/api/expenses/${self.body.id}/submit`,'POST',{},'finance'),'owner claim submitted');
    await expect(403,call(`/api/expenses/${self.body.id}/approve`,'POST',{},'manager'),'self-approval denied');

    await expect(200,call('/api/enterprise','GET',undefined,'auditor'),'auditor read access');
    await expect(200,call('/api/audit','GET',undefined,'auditor'),'auditor read-only audit access');
    const before=await call('/api/enterprise','GET',undefined,'admin');
    const draft=await expect(201,call('/api/expenses','POST',{employeeId:'E0001003',date:'2026-09-24',category:'Travel',amount:17,description:'Mass assignment test'},'finance'),'draft for mass assignment check');
    await expect(200,call(`/api/expenses/${draft.body.id}`,'PATCH',{status:'Posted',employeeId:'E0001005',role:'FINANCE_ADMIN'},'finance'),'mass assignment status ignored');
    const unchanged=await call(`/api/expenses/${draft.body.id}`,'GET',undefined,'finance');
    assert.equal(unchanged.body.status,'Draft');assert.equal(unchanged.body.employeeId,'E0001003');
    assert.ok(before.body.audit.some(x=>x.action==='AUTHZ_DENIED'),'authorization failures are audited');

    await expect(201,call('/api/transactions','POST',{emp:'E0001002',date:'20261001',cat:'FOOD',amount:10,desc:'batch auth test'},'finance'),'finance-only dataset input');
    await expect(403,call('/api/transactions','POST',{emp:'E0001002',date:'20261001',cat:'FOOD',amount:10,desc:'bad actor'},'auditor'),'auditor dataset write denied');
    const run=await expect(200,call('/api/run','POST',{},'finance'),'authorized batch execution');
    assert.equal(run.body.raw,1);assert.equal(run.body.rc,0);
    const mismatch=await expect(200,call('/api/run','POST',{breakCount:true},'finance'),'count mismatch branch');assert.equal(mismatch.body.rc,12);
    await expect(403,call('/api/employees','POST',{id:'E0001012',name:'role escalation',department:'x',costCentre:'x'},'auditor'),'auditor employee write denied');
    await expect(404,call('/api/audit','POST',{entry:'tamper'},'admin'),'audit immutable through API');
    await expect(200,call('/api/auth/logout','POST',{},'employee'),'logout');
    await expect(401,call('/api/enterprise','GET',undefined,'employee'),'session invalidated on logout');
    console.log('authorization HTTP tests passed for all roles, object scope, workflow transitions, batch controls, audit, and logout');
  } finally {
    await new Promise(resolve=>server.close(resolve));
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
