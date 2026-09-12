const assert=require('node:assert/strict');
require('./scoring.js');
const S=globalThis.CampusScoring;
const now=new Date('2026-09-10T00:00:00+08:00');

function job(overrides={}){
  return {
    id:'q',company:'小米集团',title:'2027届海外业务运营',city:'深圳',graduationYear:'2027',
    source:'企业官方招聘',sourceType:'official',sourceChannel:'official_ats',sourceUrl:'https://jobs.example.com/detail/1',
    description:'负责海外市场研究、英文业务资料、客户信息整理和跨部门项目推进。',
    roleFamily:['海外业务'],skills:['英语'],languages:['英语'],experienceKeywords:['海外业务','市场研究'],
    candidateFit:{major:{evidence:['本科及以上，英语等相关专业优先']},eligibilityEvidence:['2027届'],responsibility:{business:['海外业务'],technical:[]}},
    ...overrides
  };
}

// 1. 分类正确性：命中关键词的公司/岗位落到对应赛道
assert.equal(S.industryTrend(job({company:'蔚来汽车'})).trend,'上升','新能源整车厂应判上升');
assert.equal(S.industryTrend(job({company:'中芯国际'})).trend,'上升','半导体龙头应判上升');
assert.equal(S.industryTrend(job({company:'安克创新'})).trend,'上升','跨境电商品牌出海应判上升');
assert.equal(S.industryTrend(job({company:'新东方教育科技'})).trend,'承压','教培公司应判承压');
assert.equal(S.industryTrend(job({company:'某文化传播有限公司',title:'2027届翻译专员'})).trend,'承压','纯翻译岗位标题应判承压');
assert.equal(S.industryTrend(job({company:'某传统制造有限公司'})).trend,'平台','未命中关键词应默认判平台');

// 2. 只看公司名/岗位标题，不扫 JD 正文——避免"五险一金/补充医疗保险"等福利条款把岗位误判成医疗行业
const benefitsNoise=job({company:'某软件科技有限公司',description:'福利待遇：五险一金、补充医疗保险、免费班车、新能源班车通勤。'});
assert.equal(S.industryTrend(benefitsNoise).trend,'平台','JD 正文的福利关键词不应触发行业分类');

// 3. 纯展示：不改变 fit/priority/level/recommendationLevel
const base=job();
const withEvaluate=S.evaluate(base,now);
const stripped={...base};
const evalStripped=S.evaluate(stripped,now);
assert.deepEqual(withEvaluate.fit,evalStripped.fit,'industryTrend 不得改变 fit 分数');
assert.equal(withEvaluate.priorityScore,evalStripped.priorityScore,'industryTrend 不得改变 priorityScore');
assert.equal(withEvaluate.level,evalStripped.level,'industryTrend 不得改变最终 level');
assert.equal(withEvaluate.recommendationLevel,evalStripped.recommendationLevel,'industryTrend 不得改变 recommendationLevel');

// 4. evaluate() 结果必须挂载 industryTrend 字段，且写入 reasoning 供看板展示
const rising=S.evaluate(job({company:'蔚来汽车'}),now);
assert.equal(rising.industryTrend.trend,'上升');
assert.match(rising.reasoning.industryTrend,/仅供参考，不计入匹配分\/优先分/,'reasoning 必须明确标注不进分');

console.log('scoring-v1.4-industry: all industry trend advisory tests passed');
