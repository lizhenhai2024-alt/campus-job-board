const assert=require('assert');
const api=require('./jobs.js');
const Logic=require('../logic-correctness.js');

const sample=`// generated\nexport const liveJobs = [\n${Array.from({length:130},(_,i)=>JSON.stringify({id:`j${i+1}`,company:`C${i+1}`,title:`T${i+1}`,nested:{text:i===5?'brace } inside string':'ok'}})).join(',\n')}\n];\nexport const meta={updatedAt:'x'};`;
const all=api.parseJobs(sample);
assert.strictEqual(all.length,130,'API must parse the complete upstream pool before ranking');
assert.strictEqual(all[0].id,'j1');
assert.strictEqual(all[129].id,'j130');
assert.strictEqual(all[5].nested.text,'brace } inside string');
const first100=api.parseJobs(sample,100);
assert.strictEqual(first100.length,100,'parser limit remains available for bounded tests');
assert.strictEqual(api.clampLimit('999'),100);
assert.strictEqual(api.clampLimit('20'),20);
assert.strictEqual(api.clampLimit('bad'),100);

// Full-pool ranking regression: a high-score job after position 100 must still reach returned top jobs.
const pool=Array.from({length:130},(_,i)=>({id:`r${i+1}`,score:i===129?999:i,eligible:true}));
const stubScoring={
  evaluate(job){return {gate:{passed:job.eligible!==false,reasons:[]},dataQuality:{status:'VALID'},priorityScore:job.score,fit:{score:job.score},level:'A'};},
  compare(a,b){return b._evaluation.priorityScore-a._evaluation.priorityScore;}
};
const ranked=api.selectTopJobs(pool,5,new Date('2026-09-16T00:00:00+08:00'),stubScoring);
assert.strictEqual(ranked.jobs[0].id,'r130','job after upstream index 100 must be eligible for final top-100');
assert.strictEqual(ranked.eligibleCount,130);

const baseGate=()=>({passed:true,reasons:[]});
assert.strictEqual(Logic.strictGate({title:'海外运营',description:'欢迎应届生',graduationYear:''},new Date(),baseGate).passed,false,'missing explicit 2027 evidence must not default to eligible');
assert.strictEqual(Logic.strictGate({title:'2027届海外运营',graduationYear:'2027',jobRequirements:'要求日语N1，可作为工作语言。'},new Date(),baseGate).passed,false,'requirements-only mandatory Japanese must be caught');
assert.strictEqual(Logic.strictGate({title:'2027届海外运营',graduationYear:'2027',jobRequirements:'英语或日语均可。'},new Date(),baseGate).passed,true,'English alternative in same requirement clause must remain eligible');
assert.strictEqual(Logic.strictGate({title:'2027届海外运营',graduationYear:'2027',jobRequirements:'英语或日语均可。要求日语N1，可作为工作语言。'},new Date(),baseGate).passed,false,'an English alternative elsewhere must not waive a separate mandatory Japanese clause');
assert.strictEqual(Logic.strictGate({title:'2027届业务运营（硕士优先）',graduationYear:'2027',description:'本科及以上学历'},new Date(),baseGate).passed,true,'master preferred must not be treated as master-only');
assert.strictEqual(Logic.strictGate({title:'2027届业务运营',graduationYear:'2027',jobRequirements:'本科及以上；必须熟练掌握 SQL'},new Date(),baseGate).passed,false,'requirements-only hard technical gate must be caught');

assert.strictEqual(Logic.directJobUrl('https://jobs.example.com/campus'),false,'campus homepage is not a direct job URL');
assert.strictEqual(Logic.directJobUrl('https://jobs.example.com/positions/12345'),true,'position detail path is a direct job URL');
assert.strictEqual(Logic.directJobUrl('https://jobs.example.com/campus?jobId=12345'),true,'jobId URL is a direct job URL');

console.log('PASS full-pool ranked API and strict eligibility');