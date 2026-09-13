const assert=require('node:assert/strict');
const CF=require('./career-fit.js');

const blank=CF.blankState();
let p=CF.profile(blank);
assert.equal(p.completion,0);
for(const k of Object.keys(CF.DIRECTIONS)){
  assert.equal(p.interestScores[k].score,null,`blank interest ${k}`);
  assert.equal(p.evidenceScores[k].score,null,`blank evidence ${k}`);
}

const max=CF.blankState();
CF.INTEREST.forEach((_,i)=>max.interest[i]=5);
CF.EVIDENCE.forEach((_,i)=>max.evidence[i]=3);
CF.WORK.forEach((_,i)=>max.work[i]=0);
p=CF.profile(max);
assert.equal(p.completion,100);
for(const k of Object.keys(CF.DIRECTIONS)){
  assert.equal(p.interestScores[k].score,100,`max interest ${k}`);
  assert.equal(p.evidenceScores[k].score,100,`max evidence ${k}`);
  assert.deepEqual(p.workstyleConflicts[k],[],`no conflict ${k}`);
}

const min=CF.blankState();
CF.INTEREST.forEach((_,i)=>min.interest[i]=1);
CF.EVIDENCE.forEach((_,i)=>min.evidence[i]=0);
p=CF.profile(min);
for(const k of Object.keys(CF.DIRECTIONS)){
  assert.equal(p.interestScores[k].score,0,`min interest ${k}`);
  assert.equal(p.evidenceScores[k].score,0,`min evidence ${k}`);
}

const partial=CF.blankState();
partial.interest[0]=5;
partial.evidence[0]=3;
p=CF.profile(partial);
assert.equal(p.interestScores.gtm.score,100);
assert.equal(p.interestScores.gtm.answered,1);
assert.ok(p.ranking.find(x=>x.key==='gtm').confidence<100);

const conflict=CF.blankState();
conflict.work[0]=2;
conflict.work[6]=1;
p=CF.profile(conflict);
assert.ok(p.workstyleConflicts.sales.includes('长期驻外（一到两年起）'));
assert.ok(p.workstyleConflicts.sales.includes('需确认：主动承受拒绝'));
assert.equal(p.interestScores.sales.score,null,'workstyle must not alter interest');

assert.equal(CF.DIRECTIONS.supply.board,'国际物流·供应链管培');
console.log('career-fit tests: PASS');
