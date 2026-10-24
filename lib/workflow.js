'use strict';
// Local demonstration workflow. Persisted JSON is explicitly not a production DB2 adapter.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { masterId } = require('./pipeline');
const FILE = path.join(process.env.APP_DATA_DIR || path.join(__dirname, '..', 'data'), 'workflow-demo.json');
const ROLES = ['EMPLOYEE', 'MANAGER', 'FINANCE_OPERATOR', 'FINANCE_ADMIN', 'AUDITOR'];
const CATEGORIES = ['Travel', 'Accommodation', 'Meals', 'Office Supplies', 'Utilities', 'Medical', 'Training', 'Communication', 'Other'];
function load() {
  if (!fs.existsSync(FILE)) return { expenses: [], employees: [], approvals: [], batches: [], audit: [], posted: [] };
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { expenses: [], employees: [], approvals: [], batches: [], audit: [], posted: [] }; }
}
let db = load();
const save = () => { const tmp = FILE + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db, null, 2), { flag: 'wx' }); fs.renameSync(tmp, FILE); };
const id = prefix => prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
function audit(actor, action, entity, outcome, correlationId) { db.audit.unshift({ id: id('AU'), actor: actor.name, role: actor.role, action, entity, outcome, correlationId: correlationId || null, at: new Date().toISOString() }); }
function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
function readEmployees() {
  const f = path.join(__dirname, '..', 'data', 'EMPLOYEE.MASTER');
  let base = [];
  if (fs.existsSync(f)) base = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map(line => ({ id: masterId(line), name: line.slice(28,80).trim(), department: 'Corporate Services', designation: 'Employee', managerId: 'E0001001', costCentre: 'ACS-100', status: 'Active' }));
  const additions = db.employees;
  return base.map(x => additions.find(a => a.id === x.id) || x).concat(additions.filter(a => !base.some(b => b.id === a.id)));
}
function createExpense(input, actor) {
  if (!['EMPLOYEE','FINANCE_OPERATOR','FINANCE_ADMIN'].includes(actor.role)) fail(403, 'Role cannot create expenses');
  const empId = String(input.employeeId || actor.employeeId).trim().toUpperCase();
  if (actor.role === 'EMPLOYEE' && empId !== actor.employeeId) fail(403, 'Employees can create expenses only for themselves');
  const employee = readEmployees().find(e => e.id === empId && e.status === 'Active');
  if (!employee) fail(400, 'Active employee ID is required');
  const date = String(input.date || ''), parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T00:00:00Z') : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== date) fail(400, 'Valid transaction date is required');
  const amount = Number(input.amount); if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount*100) !== amount*100 || amount > 9999999.99) fail(400, 'Amount must be positive with no more than two decimals');
  const category = CATEGORIES.includes(input.category) ? input.category : null; if (!category) fail(400, 'Select a configured expense category');
  const description = String(input.description || '').trim(); if (!description || description.length > 39) fail(400, 'Description is required (maximum 39 characters for the batch layout)');
  const duplicate = db.expenses.find(e => e.employeeId === empId && e.date === date && e.amount === amount && e.category === category && e.description === description && e.status !== 'Rejected');
  if (duplicate) fail(409, 'Possible duplicate expense exists: ' + duplicate.id);
  const expense = { id: id('EX'), transactionId: 'TX' + crypto.randomBytes(5).toString('hex').toUpperCase(), employeeId: empId, employeeName: employee.name, department: employee.department, designation: employee.designation, managerId: employee.managerId, costCentre: employee.costCentre, date, category, amount, currency: 'INR', description, reference: String(input.reference || '').slice(0,30), status: 'Draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  db.expenses.unshift(expense); audit(actor, 'EXPENSE_CREATE', expense.id, 'SUCCESS'); save(); return expense;
}
function updateExpense(expense, input, actor) {
  if (!['Draft','Rejected'].includes(expense.status)) fail(409, 'Only draft or rejected expenses can be edited');
  Object.assign(expense, { description: String(input.description ?? expense.description).trim(), reference: String(input.reference ?? expense.reference).slice(0,30), updatedAt: new Date().toISOString() });
  if (!expense.description || expense.description.length > 39) fail(400, 'Description is required (maximum 39 characters)');
  audit(actor, 'EXPENSE_UPDATE', expense.id, 'SUCCESS'); save(); return expense;
}
function recordBatch(result, actor) {
  const b = { id: id('BR'), job: result.engine === 'COBOL' ? 'COBOL batch: EXPDEDUP > MATCH2 > EXPVALID > EXPTOTAL > EXPRPT > CNTCHECK' : 'Local fixed-width validation and report (Node simulator)', status: result.countOk ? 'Completed' : 'Failed', submittedAt: new Date().toISOString(), completedAt: new Date().toISOString(), inputCount: result.raw, outputCount: result.report.length, duplicateCount: result.dups.length, rejectedCount: result.exceptions.length, postedCount: 0, returnCode: result.rc, environment: result.engine === 'COBOL' ? 'GNUCOBOL_LOCAL' : 'LOCAL_DEMO', engine: result.engine || 'JS_SIMULATOR', steps: (result.steps || []).map(x => ({ step: x.step, program: x.program, rc: x.rc })), errorSummary: result.countOk ? '' : result.message, datasets: ['EXPENSE.TRANS','EXPENSE.CLEAN','EXPENSE.MATCHED','EXPENSE.VALID','EXPENSE.REJECT','EXPENSE.REPORT'] };
  db.batches.unshift(b); audit(actor, 'BATCH_COMPLETE', b.id, b.status, b.id); save(); return b;
}
function visibleExpenses(actor) {
  if (actor.role === 'EMPLOYEE') return db.expenses.filter(x => x.employeeId === actor.employeeId);
  if (actor.role === 'MANAGER') return db.expenses.filter(x => x.managerId === actor.employeeId);
  return db.expenses;
}
function workflow(actor, url, body) {
  const p = url.pathname, method = url.method;
  if (method === 'GET' && p === '/api/enterprise') {
    const visible = visibleExpenses(actor), visibleIds = new Set(visible.map(x => x.id));
    const canReadBatch = ['FINANCE_OPERATOR','FINANCE_ADMIN','AUDITOR'].includes(actor.role);
    return { ok:true, actor, roles:ROLES, categories:CATEGORIES, expenses:visible, employees:readEmployees(), approvals:db.approvals.filter(x => visibleIds.has(x.expenseId)), batches:canReadBatch?db.batches:[], audit:['FINANCE_ADMIN','AUDITOR'].includes(actor.role)?db.audit:[], posted:canReadBatch?db.posted:[] };
  }
  if (method === 'GET' && p === '/api/dashboard') {
    const e = visibleExpenses(actor), sum = rows => rows.reduce((a,x)=>a+x.amount,0);
    const bucket = (field) => Object.values(e.reduce((o,x)=>{const k=x[field]||'Unassigned';o[k] ||= {name:k,count:0,amount:0};o[k].count++;o[k].amount+=x.amount;return o;},{}));
    const canReadBatch = ['FINANCE_OPERATOR','FINANCE_ADMIN','AUDITOR'].includes(actor.role);
    const pending=e.filter(x=>x.status==='Pending approval'), approved=e.filter(x=>x.status==='Approved'), posted=e.filter(x=>x.status==='Posted');
    const base={role:actor.role, recent:e.slice(0,8), batches:canReadBatch?db.batches.slice(0,5):[]};
    if(actor.role==='EMPLOYEE') return {...base,submittedCount:e.filter(x=>x.status!=='Draft').length,submittedAmount:sum(e.filter(x=>x.status!=='Draft')),pendingCount:pending.length,pendingAmount:sum(pending),completedCount:approved.length+posted.length,completedAmount:sum(approved)+sum(posted),categories:bucket('category')};
    if(actor.role==='MANAGER'){
      const ids=new Set(e.map(x=>x.id)), reviews=db.approvals.filter(x=>ids.has(x.expenseId)&&['APPROVED','REJECTED'].includes(x.action)).slice(0,6).map(a=>({...a,expense:e.find(x=>x.id===a.expenseId)}));
      return {...base,pendingCount:pending.length,pendingAmount:sum(pending),teamCount:new Set(e.map(x=>x.employeeId)).size,teamAmount:sum(e.filter(x=>x.status!=='Rejected')),reviewed:reviews,categories:bucket('category')};
    }
    const latest=db.batches[0]||null;
    const finance={...base,expenseCount:e.length,expenseTotal:sum(e),approvedCount:approved.length,approvedAmount:sum(approved),rejectedCount:e.filter(x=>x.status==='Rejected').length,latestBatch:latest,reconciliation:latest?(latest.status==='Failed'?'MISMATCH':'MATCHED'):'NO_RUN',categories:bucket('category')};
    if(actor.role==='FINANCE_ADMIN')return {...finance,employeeCount:readEmployees().length,categoryCount:CATEGORIES.length,auditCount:db.audit.length};
    if(actor.role==='FINANCE_OPERATOR')return finance;
    return {...finance,auditCount:db.audit.length};
  }
  if (method === 'GET' && p === '/api/reports') { const e=visibleExpenses(actor), ids=new Set(e.map(x=>x.id)); return { expenses:e, approvals:db.approvals.filter(x=>ids.has(x.expenseId)), batches:['FINANCE_OPERATOR','FINANCE_ADMIN','AUDITOR'].includes(actor.role)?db.batches:[] }; }
  if (method === 'GET' && p === '/api/audit' && !['FINANCE_ADMIN','AUDITOR'].includes(actor.role)) fail(403,'Audit access requires Finance Administrator or Auditor role');
  if (method === 'GET' && p === '/api/audit') return db.audit;
  if (method === 'POST' && p === '/api/expenses') return createExpense(body, actor);
  if (method === 'POST' && p === '/api/employees') {
    if (actor.role !== 'FINANCE_ADMIN') fail(403,'Finance Administrator role required');
    const x={id:String(body.id||'').toUpperCase(),name:String(body.name||'').trim(),department:String(body.department||'').trim(),designation:String(body.designation||'Employee'),managerId:String(body.managerId||''),costCentre:String(body.costCentre||''),status:body.status==='Inactive'?'Inactive':'Active'};
    if(!/^E\d{7}$/.test(x.id)||!x.name||!x.department||!x.costCentre||readEmployees().some(e=>e.id===x.id))fail(400,'Unique employee ID (E plus 7 digits), name, department and cost centre are required');
    if(x.managerId&&!readEmployees().some(e=>e.id===x.managerId&&e.status==='Active'))fail(400,'Manager ID must identify an active employee');
    db.employees.push(x); audit(actor,'EMPLOYEE_CREATE',x.id,'SUCCESS'); save(); return x;
  }
  const match=p.match(/^\/api\/expenses\/([^/]+)(?:\/(submit|approve|reject|post))?$/);
  if(match){const expense=db.expenses.find(x=>x.id===match[1]);if(!expense)fail(404,'Expense not found');const action=match[2];
    if(method==='GET'&&!action){if(!visibleExpenses(actor).some(x=>x.id===expense.id))fail(403,'Expense access denied');return expense;}
    if(method==='PATCH'&&!action){if(actor.role==='EMPLOYEE'&&actor.employeeId!==expense.employeeId)fail(403,'Employees can edit only their own expense');if(!['EMPLOYEE','FINANCE_OPERATOR','FINANCE_ADMIN'].includes(actor.role))fail(403,'Role cannot edit expenses');return updateExpense(expense,body,actor);}
    if(method==='POST'&&action==='submit'){
      if(actor.role==='EMPLOYEE'&&actor.employeeId!==expense.employeeId)fail(403,'Employees can submit only their own expense');
      if(!['EMPLOYEE','FINANCE_OPERATOR','FINANCE_ADMIN'].includes(actor.role))fail(403,'Role cannot submit expenses');
      if(!['Draft','Rejected'].includes(expense.status))fail(409,'Expense is already in workflow'); expense.status='Pending approval';expense.updatedAt=new Date().toISOString();db.approvals.push({expenseId:expense.id,actor:actor.name,action:'SUBMITTED',comment:String(body.comment||''),at:new Date().toISOString()});audit(actor,'EXPENSE_SUBMIT',expense.id,'SUCCESS');save();return expense;
    }
    if(method==='POST'&&(action==='approve'||action==='reject')){
      if(!['MANAGER','FINANCE_ADMIN'].includes(actor.role))fail(403,'Manager role required');
      if(actor.role==='MANAGER'&&actor.employeeId!==expense.managerId)fail(403,'Only the assigned manager may review this expense');
      if(actor.employeeId===expense.employeeId)fail(403,'Self-approval is not allowed');if(expense.status!=='Pending approval')fail(409,'Expense is not pending approval');
      const reason=String(body.reason||body.comment||'').trim();if(action==='reject'&&!reason)fail(400,'A rejection reason is required');expense.status=action==='approve'?'Approved':'Rejected';expense.updatedAt=new Date().toISOString();db.approvals.push({expenseId:expense.id,actor:actor.name,action:action.toUpperCase()+'D',comment:reason,at:new Date().toISOString()});audit(actor,'EXPENSE_'+action.toUpperCase(),expense.id,'SUCCESS');save();return expense;
    }
    if(method==='POST'&&action==='post'){
      if(!['FINANCE_OPERATOR','FINANCE_ADMIN'].includes(actor.role))fail(403,'Finance Operator role required');if(expense.status!=='Approved')fail(409,'Only approved expenses can be posted');
      if(db.posted.includes(expense.transactionId))fail(409,'Transaction has already been posted');db.posted.push(expense.transactionId);expense.status='Posted';expense.updatedAt=new Date().toISOString();audit(actor,'EXPENSE_POST',expense.id,'SUCCESS');save();return expense;
    }
  }
  return null;
}
function recordSecurityEvent(action, entity, outcome) {
  db.audit.unshift({ id: id('AU'), actor: 'SYSTEM', role: 'SYSTEM', action, entity, outcome, correlationId: null, at: new Date().toISOString() }); save();
}
module.exports={workflow,fail,save,load,recordBatch,recordSecurityEvent};
