const assert=require('assert');
const loader=require('./app.js');

const many=Array.from({length:140},(_,i)=>({id:`j${i+1}`,company:`公司${i+1}`,title:`岗位${i+1}`}));
const curated=[{id:'c1',company:'精选A',title:'海外运营'},{id:'c2',company:'精选B',title:'GTM'}];
const top=loader.composeTopJobs(many,curated,100);
assert.strictEqual(top.length,100,'board must cap jobs at 100');
assert.strictEqual(top[0].id,'c1','curated jobs stay first');
assert.strictEqual(top[1].id,'c2','curated jobs stay first');

const dedup=loader.composeTopJobs([{id:'x2',company:'A',title:'海外 运营'}],[{id:'x1',company:'A',title:'海外运营'}],100);
assert.strictEqual(dedup.length,1,'same company/title should be de-duplicated');

assert.strictEqual(loader.isLiveJobsUrl('https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/live-jobs.js'),true);
assert.strictEqual(loader.isLiveJobsUrl('https://cdn.jsdelivr.net/gh/lizhenhai2024-alt/AI_Job@main/src/data/live-jobs.js'),true);
assert.strictEqual(loader.isLiveJobsUrl('/api/jobs?limit=100'),false);

const moduleText=loader.moduleTextForTopJobs({jobs:many,meta:{source:'test'}},curated);
assert(moduleText.includes('export const liveJobs='));
assert(moduleText.includes('"top100Only":true'));
assert(moduleText.includes('"count":100'));

const bootstrapRoot={
  YINGZHUAN_JOBS:Array.from({length:120},(_,i)=>({id:`y${i}`,company:`Y${i}`,title:`T${i}`})),
  YINGZHUAN_META:{A:{fullName:'公司A'}}
};
assert.strictEqual(loader.prepareBootstrap(bootstrapRoot),100);
assert.strictEqual(bootstrapRoot.EMBEDDED_JOBS.length,100);
assert.strictEqual(bootstrapRoot.EMBEDDED_META.top100Only,true);
assert.strictEqual(bootstrapRoot.EMBEDDED_META.limit,100);

console.log('PASS top-100 app loader');
