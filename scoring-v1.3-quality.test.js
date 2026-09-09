const assert=require('node:assert/strict');
require('./scoring-v1.1.js');
require('./scoring-v1.1-language-patch.js');
require('./scoring-v1.2-calibration-patch.js');
require('./scoring-v1.3-quality-patch.js');
const S=globalThis.CampusScoring;
const now=new Date('2026-09-10T00:00:00+08:00');

function job(overrides={}){
  return {
    id:'q',company:'小米集团',title:'2027届海外业务运营',city:'深圳',graduationYear:'2027',
    source:'某大学就业信息网',sourceType:'secondary',sourceChannel:'university',sourceUrl:'https://career.example.edu.cn/detail/1',
    description:'负责海外市场研究、英文业务资料、客户信息整理和跨部门项目推进。',
    roleFamily:['海外业务'],skills:['英语'],languages:['英语'],experienceKeywords:['海外业务','市场研究'],
    candidateFit:{major:{evidence:['本科及以上，英语等相关专业优先']},eligibilityEvidence:['2027届'],responsibility:{business:['海外业务'],technical:[]}},
    ...overrides
  };
}

assert.equal(S.suspiciousCompany(job()),'','标准公司简称不得误杀');
assert.equal(S.suspiciousCompany(job({company:'Babycare'})),'','英文品牌名不得误杀');
assert.equal(S.suspiciousCompany(job({company:'招商银行股份有限公司长沙分行'})),'','完整法人/分支机构名不得误杀');

for(const bad of ['就业办2019','就业处','关于做好','感谢贵单位一直以来对我校就业工作的支持','待核公司']){
  const e=S.evaluate(job({company:bad}),now);
  assert.equal(e.dataQuality.status,'INVALID',`${bad} 应判 INVALID`);
  assert.equal(e.level,'数据待修复',`${bad} 不得进入正常推荐等级`);
}

const school=S.evaluate(job({company:'湖南大学',universitySource:{school:'湖南大学'}}),now);
assert.equal(school.dataQuality.status,'INVALID','高校名称误作公司必须 INVALID');

const normal=S.evaluate(job(),now);
assert.notEqual(normal.dataQuality.status,'INVALID','正常公司记录不能被质量兜底误杀');
assert.notEqual(normal.level,'数据待修复','正常公司记录应继续参与推荐');

console.log('scoring-v1.3-quality: all company entity guard tests passed');
