const assert=require('assert');
const CF=require('./career-fit.js');
const P=require('./career-personalization.js');

function fullState(){
  const s=CF.blankState();
  CF.INTEREST.forEach((q,i)=>{s.interest[i]=q[1]==='hr'?1:5;});
  CF.EVIDENCE.forEach((q,i)=>{s.evidence[i]=2;});
  CF.WORK.forEach((q,i)=>{s.work[i]=0;});
  return s;
}
function base(direction='GTM·市场策略',careerValue=15,riskItems=[]){
  const parts={responsibility:25,majorLanguage:18,experience:20,careerValue,learnability:8};
  const fit=Object.values(parts).reduce((a,b)=>a+b,0);
  const riskDeduction=riskItems.reduce((s,x)=>s+x.value,0);
  return {
    direction,
    gate:{passed:true,reasons:[]},
    fit:{score:fit,parts},
    fitLevel:'S',
    dataQuality:{score:8,status:'VALID',reasons:[]},
    risk:{deduction:riskDeduction,items:riskItems.map(x=>({...x}))},
    priorityScore:fit-riskDeduction,
    level:'A',recommendationLevel:'A',
    experienceEvidence:{strongDirect:true},
    reasoning:{}
  };
}

// 1. 完成度不足60%：绝不改变原评分
{
  const s=CF.blankState();s.interest[0]=5;
  const b=base();const old={fit:b.fit.score,priority:b.priorityScore,level:b.level};
  const r=P.personalizeEvaluation(b,{},s,CF,{});
  assert.equal(r.personalization.active,false);
  assert.equal(r.fit.score,old.fit);
  assert.equal(r.priorityScore,old.priority);
  assert.equal(r.level,old.level);
}

// 2. 完整测评后：职业方向15分动态化，其他四个能力维度不得变化
{
  const s=fullState();
  const b=base('GTM·市场策略',15);
  const before={...b.fit.parts};
  const r=P.personalizeEvaluation(b,{},s,CF,{});
  assert.equal(r.personalization.active,true);
  assert.equal(r.fit.parts.responsibility,before.responsibility);
  assert.equal(r.fit.parts.majorLanguage,before.majorLanguage);
  assert.equal(r.fit.parts.experience,before.experience);
  assert.equal(r.fit.parts.learnability,before.learnability);
  assert.ok(r.fit.parts.careerValue>=13,'GTM高兴趣应保持较高方向价值');
  assert.ok(r.personalization.capabilityScore>=80,'能力准备度应独立计算');
}

// 3. 低兴趣HR不能继续沿用原静态职业方向值
{
  const s=fullState();
  const r=P.personalizeEvaluation(base('HR·HRBP',9),{},s,CF,{});
  assert.ok(r.fit.parts.careerValue<9,'低兴趣HR应降低职业方向价值');
  assert.ok(r.personalization.interest<=10);
}

// 4. 明确能接受驻外时，长期海外个人摩擦不再机械扣15分
{
  const s=fullState();s.work[0]=0;
  const r=P.personalizeEvaluation(base('外贸·海外业务',14,[{label:'长期海外工作地点',value:15}]),{},s,CF,{});
  assert.equal(r.risk.deduction,0);
  assert.equal(r.risk.items.length,0);
}

// 5. 明确不能驻外时，原驻外风险完整保留
{
  const s=fullState();s.work[0]=2;
  const r=P.personalizeEvaluation(base('外贸·海外业务',14,[{label:'长期派驻/驻外',value:15}]),{},s,CF,{});
  assert.equal(r.risk.deduction,15);
  assert.equal(r.risk.items[0].value,15);
}

// 6. Gate失败永远不能被兴趣抬回正常等级
{
  const s=fullState();const b=base();b.gate={passed:false,reasons:['仅招硕士']};b.level='不符合硬条件';b.recommendationLevel='不符合硬条件';
  const r=P.personalizeEvaluation(b,{},s,CF,{});
  assert.equal(r.level,'不符合硬条件');
  assert.equal(r.recommendationLevel,'不符合硬条件');
}

// 7. PARTIAL质量仍然最高B
{
  const s=fullState();const b=base();b.dataQuality={score:6,status:'PARTIAL',reasons:[]};
  const r=P.personalizeEvaluation(b,{},s,CF,{});
  assert.ok(['B','C','D'].includes(r.level));
}

console.log('PASS career-personalization.test.js');
