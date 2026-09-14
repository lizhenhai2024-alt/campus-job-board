const assert=require('assert');
const api=require('./jobs.js');

const sample=`// generated\nexport const liveJobs = [\n${Array.from({length:130},(_,i)=>JSON.stringify({id:`j${i+1}`,company:`C${i+1}`,title:`T${i+1}`,nested:{text:i===5?'brace } inside string':'ok'}})).join(',\n')}\n];\nexport const meta={updatedAt:'x'};`;
const jobs=api.parseTopJobs(sample,100);
assert.strictEqual(jobs.length,100);
assert.strictEqual(jobs[0].id,'j1');
assert.strictEqual(jobs[99].id,'j100');
assert.strictEqual(jobs[5].nested.text,'brace } inside string');
assert.strictEqual(api.clampLimit('999'),100);
assert.strictEqual(api.clampLimit('20'),20);
assert.strictEqual(api.clampLimit('bad'),100);
console.log('PASS top-100 API parser');
