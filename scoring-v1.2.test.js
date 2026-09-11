const assert=require('node:assert/strict');
require('./scoring.js');
const S=globalThis.CampusScoring;
const now=new Date('2026-09-10T00:00:00+08:00');

function job(overrides={}){
  return {
    id:'t',company:'测试公司',title:'海外业务运营（2027届）',city:'深圳',graduationYear:'2027',
    source:'公司官方招聘官网',sourceType:'official',sourceUrl:'https://example.com/campus/detail?jobId=1',
    deadline:'2026-12-31',publishedAt:'2026-09-01',roleFamily:['海外业务'],skills:['英语','Excel'],languages:['英语'],
    experienceKeywords:['海外业务','竞品分析','市场研究'],preferenceTags:['国际业务','出海'],riskTags:[],
    description:'负责海外市场研究、竞品分析、英文业务资料、客户信息整理和跨部门项目推进。',
    candidateFit:{major:{evidence:['本科及以上，英语、国际商务、市场营销等相关专业优先']},eligibilityEvidence:['招聘对象：2027届'],responsibility:{business:['海外业务','市场研究'],technical:[]}},
    ...overrides
  };
}

assert.equal(S.gate(job({description:'面向2027届应届硕士毕业生，不限专业。'}),now).passed,false,'仅硕士必须排除');
assert.equal(S.gate(job({title:'27届科技项目管理工程师（博士）'}),now).passed,false,'博士岗位必须排除');
assert.equal(S.gate(job({description:'本科及以上，硕士优先。'}),now).passed,true,'本科明确可投时硕士优先不得误杀');
assert.equal(S.gate(job({description:'本科、硕士、博士均可申请。'}),now).passed,true,'本科明确包含时不得排除');
assert.equal(S.gate(job({title:'2026校招-业务运营管培生',graduationYear:'2027'}),now).passed,false,'标题2026不能被上游2027字段放行');
assert.equal(S.gate(job({description:'要求日语N1，可作为工作语言。'}),now).passed,false,'必须日语必须排除');
assert.equal(S.gate(job({description:'英语或日语其中一种可作为工作语言。'}),now).passed,true,'英语或日语任选应通过');

const foreign=S.evaluate(job({title:'GTM Product Manager - Germany',city:'杜塞尔多夫',roleFamily:['GTM'],description:'负责GTM、海外市场研究、竞品分析和产品上市。'}),now);
assert.equal(S.foreignWorkLocation(job({title:'GTM Product Manager - Germany',city:'杜塞尔多夫'})),true,'德国岗位应识别为海外工作地');
assert.ok(foreign.risk.items.some(x=>x.label==='长期海外工作地点'&&x.value===15),'海外工作地点应扣15');
assert.equal(foreign.priorityScore,Math.max(0,foreign.fit.score-foreign.risk.deduction),'优先分必须等于适配分减风险');
assert.ok(['B','C','D','A','S','S++'].includes(foreign.level),'海外岗位仍是软降权，不做Gate');

const domestic=S.evaluate(job({title:'产品营销经理（海外业务）-27届秋招',city:'东莞',roleFamily:['GTM'],description:'负责海外产品营销和市场研究。'}),now);
assert.ok(domestic.risk.items.some(x=>x.label==='城市非目标城市'&&x.value===5),'国内非目标城市仍应仅扣5');
assert.ok(!domestic.risk.items.some(x=>x.label==='长期海外工作地点'),'东莞不能误判为海外工作地');

const thaiMarket=S.evaluate(job({title:'产品运营管培生（泰国市场）',city:'上海',roleFamily:['产品运营'],description:'工作地点上海，负责泰国市场产品运营。'}),now);
assert.equal(S.foreignWorkLocation(job({title:'产品运营管培生（泰国市场）',city:'上海'})),false,'服务泰国市场但工作地上海不能算海外工作地');
assert.ok(!thaiMarket.risk.items.some(x=>x.label==='长期海外工作地点'),'泰国市场上海岗位不能扣海外工作地风险');

const japanService=S.evaluate(job({title:'Associate - Japanese Services Group',city:'深圳',roleFamily:['其他'],description:'工作地点深圳，服务日本客户。'}),now);
assert.equal(S.foreignWorkLocation(job({title:'Associate - Japanese Services Group',city:'深圳'})),false,'Japanese Services但工作地深圳不能算海外工作地');
assert.ok(!japanService.risk.items.some(x=>x.label==='长期海外工作地点'),'国内日本业务岗位不能扣海外工作地风险');

assert.equal(S.foreignWorkLocation(job({title:'GTM Product Manager - Germany',city:'待核'})),true,'城市待核时标题明确Germany可推断海外工作地');

const topbandPmo=S.evaluate(job({
  company:'拓邦股份',
  title:'项目管理工程师（英语）',
  city:'深圳',
  roleFamily:['项目管理'],
  skills:['英语','项目管理'],
  experienceKeywords:['项目','客户'],
  preferenceTags:[],
  riskTags:[],
  description:'拓邦股份官方2027校招岗位；职类：研发类。性质：全职。',
  jobDescription:'岗位职责1、负责新项目开发的统筹与管理工作2、制定项目计划、识别项目风险，处置项目过程异常，确保项目按预期推进3、对接客户并做好诉求应答，管理内外部团队岗位要求1.本科及以上学历，机械、电子类等工科专业或英语类专业优先；2.英语CET-6或商务英语中级以上，口语流利者优先；',
  candidateFit:{major:{evidence:['1.本科及以上学历，机械、电子类等工科专业或英语类专业优先']},eligibilityEvidence:['招聘对象：2027届'],responsibility:{business:[],technical:[]}}
}),now);
assert.equal(topbandPmo.direction,'PMO·项目管理','拓邦英语项目管理应归入PMO');
assert.ok(topbandPmo.fit.parts.majorLanguage>=18,`工科或英语类优先不得把英语专业压到 ${topbandPmo.fit.parts.majorLanguage}/20`);
assert.ok(topbandPmo.fit.score>=75,`拓邦英语项目管理适配分应达A档，实际 ${topbandPmo.fit.score}`);
assert.equal(topbandPmo.level,'A','拓邦英语项目管理应对英语专业为A');

const stemOnly=S.evaluate(job({
  title:'硬件研发工程师',
  roleFamily:['其他'],
  description:'本科及以上学历，电子、机械等理工科专业优先，熟悉电路设计。',
  candidateFit:{major:{evidence:['电子、机械等理工科专业优先']},eligibilityEvidence:['招聘对象：2027届'],responsibility:{business:[],technical:['电路设计']}}
}),now);
assert.ok(stemOnly.fit.parts.majorLanguage<=10,'纯理工优先仍应压低专业语言分');

const weirdDeadline=S.evaluate(job({deadline:'2029-09-02'}),now);
assert.equal(weirdDeadline.dataQuality.status,'PARTIAL','2029异常截止日期必须降为PARTIAL');
assert.ok(['B','C','D'].includes(weirdDeadline.level),'PARTIAL最终推荐不得高于B');
assert.ok(weirdDeadline.dataQuality.reasons.some(x=>/截止日期异常/.test(x)),'异常deadline必须给出核验理由');

const normal=S.evaluate(job(),now);
assert.equal(normal.fitLevel!==undefined,true,'必须保留适配等级');
assert.equal(normal.recommendationLevel,normal.level,'level应等于最终推荐等级');
assert.ok(({'S++':6,S:5,A:4,B:3,C:2,D:1}[normal.level]||0)<=({'S++':6,S:5,A:4,B:3,C:2,D:1}[normal.fitLevel]||0),'风险后推荐不能高于适配等级');

const bad=S.evaluate(job({sourceType:'secondary',sourceUrl:'',description:'自动发现的 运营 类岗位。',candidateFit:{}}),now);
assert.equal(bad.dataQuality.status,'INVALID','坏数据仍应INVALID');
assert.equal(bad.level,'数据待修复','INVALID不得进入正常推荐等级');

console.log('scoring-v1.2: all recommendation calibration tests passed');
