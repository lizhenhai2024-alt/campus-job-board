const assert = require('node:assert/strict');
const S = require('./scoring-v1.1.js');
require('./scoring-v1.1-language-patch.js');

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

assert.equal(S.gate(job({description:'面向2027届应届硕士毕业生，不限专业，负责项目管理。'}),now).passed,false,'仅硕士岗位应Gate Fail');
assert.equal(S.gate(job({description:'研究生及以上学历，负责项目管理。'}),now).passed,false,'研究生及以上岗位应Gate Fail');
assert.equal(S.gate(job({description:'博士及以上学历，负责研发项目管理。'}),now).passed,false,'博士及以上岗位应Gate Fail');
assert.equal(S.gate(job({title:'27届科技项目管理工程师（博士）',description:'2027届校园招聘，项目管理方向。'}),now).passed,false,'标题明确博士时应Gate Fail');
assert.equal(S.gate(job({title:'海外运营（硕士）',description:'2027届校招。'}),now).passed,false,'标题明确硕士时应Gate Fail');
assert.equal(S.gate(job({description:'本科及以上学历，硕士优先，负责国际业务。'}),now).passed,true,'本科明确可投且硕士优先时不应排除');
assert.equal(S.gate(job({description:'本科、硕士、博士均可申请，负责国际业务。'}),now).passed,true,'本科明确可投时不应因硕博字样排除');

assert.equal(S.gate(job({title:'2026校招-业务运营管培生',graduationYear:'2027'}),now).passed,false,'标题明确2026校招时不能被2027字段放行');
assert.equal(S.gate(job({title:'2026届品牌运营',graduationYear:'2027'}),now).passed,false,'标题明确2026届时不能进入2027主榜');
assert.equal(S.gate(job({title:'2027届海外运营',graduationYear:'2027'}),now).passed,true,'2027标题应正常通过届别检查');

assert.equal(S.gate(job({description:'本科及以上，要求日语N1，可作为工作语言。'}),now).passed,false,'必须日语应Gate Fail');
assert.equal(S.gate(job({description:'本科及以上，英语可作为工作语言，会日语优先。'}),now).passed,true,'日语优先不应Gate Fail');
assert.equal(S.gate(job({description:'本科及以上，英语或日语其中一种可作为工作语言。'}),now).passed,true,'英语或日语任选应通过');
assert.equal(S.gate(job({description:'要求日语N1；Excel熟练者优先。'}),now).passed,false,'其他条件出现优先时仍应识别必须日语');
assert.equal(S.gate(job({description:'英语及小语种相关专业优先，本科及以上。'}),now).passed,true,'小语种专业优先不能误判为必须小语种');
assert.equal(S.gate(job({title:'GTM Product Manager (Swedish) - Sweden',description:'本科及以上，负责当地GTM。'}),now).passed,false,'标题限定Swedish应Gate Fail');

assert.equal(S.direction(job({title:'人力资源管培生',roleFamily:['项目管理'],description:'负责HR项目推进。'})),'HR·HRBP','标题明确HR时必须优先于正文项目词');
assert.equal(S.direction(job({title:'产品经理管培生',roleFamily:['项目管理'],description:'负责产品规划和跨部门项目推进。'})),'产品·业务运营','产品经理不应归入PMO');
assert.equal(S.direction(job({title:'物流商务管培生',roleFamily:['其他'],description:'负责物流商务协同。'})),'国际物流·供应链管培','物流商务应归供应链物流');
assert.equal(S.direction(job({title:'国际业务法务BP',roleFamily:['国际业务'],description:'负责国际业务法务支持。'})),'其他','法务等专业职能不能因国际业务字样进入海外业务类');

const overseas=S.evaluate(job({description:'负责海外业务和市场研究，需要长期驻外。'}),now);
assert.equal(overseas.gate.passed,true,'长期驻外不应硬Gate');
assert.equal(overseas.risk.deduction,15,'长期驻外应扣15');

const official=S.evaluate(job(),now);
const secondary=S.evaluate(job({sourceType:'secondary',source:'牛客公开职位'}),now);
assert.equal(official.fit.score,secondary.fit.score,'信息来源不能改变Candidate Fit');
assert.ok(official.dataQuality.score>secondary.dataQuality.score,'官方来源应提高Data Quality');

const bad=S.evaluate(job({sourceType:'secondary',sourceUrl:'',description:'自动发现的 运营 类岗位。',candidateFit:{}}),now);
assert.equal(bad.dataQuality.status,'INVALID','严重缺失JD应为INVALID');
assert.equal(bad.level,'数据待修复','INVALID不应进入正常等级');

const pmo=S.evaluate(job({title:'PMO项目管理',roleFamily:['项目管理'],description:'负责项目变更审批、Gate评审、跨部门协同、关键项目节点推进。'}),now);
assert.equal(pmo.experienceEvidence.strongDirect,true,'PMO岗位应命中安斯泰莫强直接经历');
assert.ok(pmo.fit.parts.experience>=21,'PMO直接经历得分应>=21');

assert.equal(S.gate(job({deadline:'2026-09-01'}),now).passed,false,'已截止岗位应Gate Fail');

console.log('scoring-v1.1: all boundary tests passed');
