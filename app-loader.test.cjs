const assert=require('assert');
const fs=require('fs');
const loader=require('./app.js');

const many=Array.from({length:140},(_,i)=>({id:`j${i+1}`,company:`公司${i+1}`,title:`岗位${i+1}`}));
const curated=[{id:'c1',company:'精选A',title:'海外运营'},{id:'c2',company:'精选B',title:'GTM'}];
const top=loader.composeTopJobs(many,curated,100);
assert.strictEqual(top.length,100,'board must cap browser payload at 100');
assert.strictEqual(top[0].id,'j1','ranked live jobs must stay ahead of curated fallback jobs');
assert.strictEqual(top[99].id,'j100','curated jobs must not displace ranked live top-100');
assert.strictEqual(top.some(x=>x.id==='c1'),false,'curated fallback must not consume live top-100 quota');

const filled=loader.composeTopJobs([{id:'j1',company:'实时A',title:'海外业务'}],curated,3);
assert.deepStrictEqual(filled.map(x=>x.id),['j1','c1','c2'],'curated jobs may only fill unused live quota');

const dedup=loader.composeTopJobs([{id:'x2',company:'A',title:'海外 运营'}],[{id:'x1',company:'A',title:'海外运营'}],100);
assert.strictEqual(dedup.length,1,'same company/title should be de-duplicated');
assert.strictEqual(dedup[0].id,'x2','live record must win de-duplication against curated copy');

assert.strictEqual(loader.isLiveJobsUrl('https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/live-jobs.js'),true);
assert.strictEqual(loader.isLiveJobsUrl('https://cdn.jsdelivr.net/gh/lizhenhai2024-alt/AI_Job@main/src/data/live-jobs.js'),true);
assert.strictEqual(loader.isLiveJobsUrl('/api/jobs?limit=100'),false);

const moduleText=loader.moduleTextForTopJobs({jobs:many,meta:{source:'test'}},curated);
assert(moduleText.includes('export const liveJobs='));
assert(moduleText.includes('"top100Only":true'));
assert(moduleText.includes('"count":100'));
assert(!moduleText.includes('"id":"c1"'),'guarded live module must not inject curated jobs when live top-100 is full');

const bootstrapRoot={
  YINGZHUAN_JOBS:Array.from({length:120},(_,i)=>({id:`y${i}`,company:`Y${i}`,title:`T${i}`})),
  YINGZHUAN_META:{A:{fullName:'公司A'}}
};
assert.strictEqual(loader.prepareBootstrap(bootstrapRoot),100);
assert.strictEqual(bootstrapRoot.EMBEDDED_JOBS.length,100);
assert.strictEqual(bootstrapRoot.EMBEDDED_META.top100Only,true);
assert.strictEqual(bootstrapRoot.EMBEDDED_META.limit,100);

(async()=>{
  let optionsSeen=null;
  const root={
    AbortController:global.AbortController,
    setTimeout,
    clearTimeout
  };
  const payload=await loader.fetchTopJobs(root,async(url,options)=>{
    optionsSeen={url,options};
    return {ok:true,json:async()=>({jobs:[{id:'1',company:'A',title:'B'}]})};
  },1000);
  assert.strictEqual(payload.jobs.length,1);
  assert.strictEqual(optionsSeen.url,'/api/jobs?limit=100');
  assert.strictEqual(optionsSeen.options.cache,'force-cache','ranked endpoint should allow browser/CDN cache reuse');

  const source=fs.readFileSync('./app.js','utf8');
  assert(!source.includes('bootstrapCore=loadCore'),'app core must not render bootstrap and ranked top100 twice');
  assert(!source.includes('replaceRoot:Boolean(bootstrapCount)'),'first load must not tear down and rebuild the board');
  assert(source.includes("LOGIC_PATCH_URL='/logic-correctness.js'"),'strict logic layer must load before app core');
  assert(source.includes('root.YINGZHUAN_JOBS=[]'),'healthy live path must disable curated merge/pinning');
  assert(source.includes("await loadCore(root,{stage:'top100'})"),'top100 path should render core exactly once');
  assert(source.includes("await loadCore(root,{stage:'bootstrap'})"),'bootstrap should only be a fallback render');
  console.log('PASS top-100 app loader');
})().catch(err=>{console.error(err);process.exitCode=1;});