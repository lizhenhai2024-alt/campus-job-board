const assert = require('node:assert/strict');
const S = require('./scoring-v1.1.js');

function job(overrides={}){
  return {
    id:'t', company:'测试公司', title:'海外业务运营', city:'深圳', graduationYear:'2027',
    source:'公司官方招聘官网', sourceType:'official', sourceUrl:'https://example.com/campus/detail?jobId=1',
    deadline:'2026-12-31', publishedAt:'2026-09-01',
    description:'负责海外市场研究、竞品分析、英文业务资料、客户信息整理和跨部门项目推进。',
    roleFamily:['海外业务'], skills:['英语','Excel'], languages:['英语'], experienceKeywords:['海外业务','竞品分析','市场研究'],
    candidateFit:{major:{evidence:['本科及以上，英语、国际商务、市场营销等相关专业优先']},eligibilityEvidence:['招聘对象：2027届'],responsibility:{business:['海外业务','市场研究'],technical:[]}},
    ...overrides
  };
}

const now = new Date('2026-09-10T00:00:00+08:00');

// 仅硕士：必须 Gate Fail
assert.equal(S.gate(job({description:'面向2027届应届硕士毕业生，不限专业，负责项目管理。'}),now).passed,false,'仅硕士岗位应Gate Fail');

// 必须日语：必须 Gate Fail
assert.equal(S.gate(job({description:'本科及以上，要求日语N1，可作为工作语言。'}),now).passed,false,'必须日语应Gate Fail');

// 日语优先：不能误杀
assert.equal(S.gate(job({description:'本科及以上，英语可作为工作语言，会日语优先。'}),now).passed,true,'日语优先不应Gate Fail');

// 英语或日语任选：英语满足
assert.equal(S.gate(job({description:'本科及以上，英语或日语其中一种可作为工作语言。'}),now).passed,true,'英语或日语任选应通过');

// 长期驻外：风险-15，但不是Gate
const overseas=S.evaluate(job({description:'负责海外业务和市场研究，需要长期驻外。'}),now);
assert.equal(overseas.gate.passed,true,'长期驻外不应硬Gate');
assert.equal(overseas.risk.deduction,15,'长期驻外应扣15');

// 信息质量独立：来源变化不改变Candidate Fit
const official=S.evaluate(job(),now);
const secondary=S.evaluate(job({sourceType:'secondary',source:'牛客公开职位'}),now);
assert.equal(official.fit.score,secondary.fit.score,'信息来源不能改变Candidate Fit');
assert.ok(official.dataQuality.score>secondary.dataQuality.score,'官方来源应提高Data Quality');

// 坏数据：不正常评级
const bad=S.evaluate(job({sourceType:'secondary',sourceUrl:'',description:'自动发现的 运营 类岗位。',candidateFit:{}}),now);
assert.equal(bad.dataQuality.status,'INVALID','严重缺失JD应为INVALID');
assert.equal(bad.level,'数据待修复','INVALID不应进入正常等级');

// PMO真实经历映射：Gate/Gate评审/变更/跨部门应构成强直接证据
const pmo=S.evaluate(job({title:'PMO项目管理',roleFamily:['项目管理'],description:'负责项目变更审批、Gate评审、跨部门协同、关键项目节点推进。'}),now);
assert.equal(pmo.experienceEvidence.strongDirect,true,'PMO岗位应命中安斯泰莫强直接经历');
assert.ok(pmo.fit.parts.experience>=21,'PMO直接经历得分应>=21');

// 已截止：Gate Fail
assert.equal(S.gate(job({deadline:'2026-09-01'}),now).passed,false,'已截止岗位应Gate Fail');

console.log('scoring-v1.1: all boundary tests passed');
