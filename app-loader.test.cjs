const assert=require('assert');
const loader=require('./app.js');

const target={};
const jobs=[{id:'j1',company:'A',title:'海外运营'}];
const risk=[[{id:'r1',company:'A'}],[{id:'r2',company:'B'}]];
const html=`<!doctype html><script>window.EMBEDDED_JOBS=${JSON.stringify(jobs)};window.EMBEDDED_META={updatedAt:'2026-09-14T00:00:00.000Z'};window.EMBEDDED_RISK=${JSON.stringify(risk)};window.EMBEDDED_COMPANY_META={A:{fullName:'公司A'}};</script>`;

assert.strictEqual(loader.applySnapshot(html,target),true,'snapshot payload should be applied');
assert.deepStrictEqual(target.EMBEDDED_JOBS,jobs);
assert.deepStrictEqual(target.EMBEDDED_RISK,risk);
assert.strictEqual(target.EMBEDDED_COMPANY_META.A.fullName,'公司A');

const priority=loader.riskModuleForUrl('https://example.com/company-risk-history-priority.js',risk);
assert(priority.includes('priorityCompanyRiskHistory'));
assert(priority.includes('r2'));
const normal=loader.riskModuleForUrl('https://example.com/company-risk-history.js',risk);
assert(normal.includes('companyRiskHistory'));
assert(normal.includes('r1'));
assert.strictEqual(loader.riskModuleForUrl('https://example.com/live-jobs.js',risk),null);

const bootstrapRoot={
  YINGZHUAN_JOBS:[{id:'y1'},{id:'y2'}],
  YINGZHUAN_META:{A:{fullName:'公司A'}}
};
assert.strictEqual(loader.prepareBootstrap(bootstrapRoot),2);
assert.strictEqual(bootstrapRoot.EMBEDDED_JOBS.length,2);
assert.strictEqual(bootstrapRoot.EMBEDDED_META.bootstrap,true);
assert.deepStrictEqual(bootstrapRoot.EMBEDDED_RISK,[[],[]]);
assert.strictEqual(bootstrapRoot.EMBEDDED_COMPANY_META.A.fullName,'公司A');

console.log('PASS app progressive loader');
