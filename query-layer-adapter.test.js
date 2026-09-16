const assert=require('node:assert/strict');
require('./scoring.js');
const S=globalThis.CampusScoring;
const Q=require('./query-layer-adapter.js');
const now=new Date('2026-09-16T00:00:00+08:00');

function q(overrides={}){
  return {
    id:'q1', company:'示例公司', title:'海外市场', graduationYear:['2027'],
    education:{raw:'本科及以上',min:'本科',masterRequired:false},
    major:{raw:'专业不限，英语专业优先',hardRestriction:false},
    language:{raw:'英语可作为工作语言',english:true,minorLanguageRequired:false},
    location:'深圳', JD:'负责海外市场研究、客户沟通、英文资料与跨部门协同。',
    source:'official', officialURL:'https://example.com/job/1', lastVerified:'2026-09-16', sourceType:'official', deadline:'',
    ...overrides
  };
}

assert.equal(S.gate(Q.adaptQueryJob(q()),now).passed,true,'2027+本科及以上+开放专业应通过');

const master=Q.adaptQueryJob(q({education:{raw:'硕士及以上',min:'硕士',masterRequired:true}}));
assert.equal(S.gate(master,now).passed,false,'Query Layer 硕士硬门槛必须进入最终 Gate');

const german=Q.adaptQueryJob(q({language:{raw:'要求德语熟练，可作为工作语言',english:false,minorLanguageRequired:true}}));
assert.equal(S.gate(german,now).passed,false,'Query Layer 必须小语种必须进入最终 Gate');

const germanPreferred=Q.adaptQueryJob(q({language:{raw:'英语可作为工作语言，德语优先',english:true,minorLanguageRequired:false}}));
assert.equal(S.gate(germanPreferred,now).passed,true,'小语种优先不能被误杀');

assert.throws(()=>Q.adaptQueryJob(q({matchScore:99})),/越权/,'AI_Job 不得携带最终匹配分');

const adapted=Q.adaptQueryJob(q({major:{raw:'国际贸易相关专业',hardRestriction:true}}));
assert.ok(adapted.jdEvidence.majorClauses.includes('国际贸易相关专业'),'专业硬门槛原文必须传给 scoring.js 判断');
assert.equal(adapted.sourceUrl,'https://example.com/job/1');

console.log('query-layer-adapter: OK');
