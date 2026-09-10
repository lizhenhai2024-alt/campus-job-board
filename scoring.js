/**
 * CampusScoring engine — merged V1.1 base + V1.1 language patch + V1.2 calibration + V1.3 quality guard.
 * Previously split across 4 files that depended on being loaded in this exact order via separate
 * <script> tags in index.html. Merged into one file to remove that load-order dependency.
 * Each section below is an unmodified copy of the original file's IIFE, still wrapping the previous
 * layer's evaluate/gate/compare exactly as before — logic is byte-for-byte unchanged, only the
 * file boundary is removed.
 */

// ===== V1.1 base (was scoring-v1.1.js) =====
(function(root){
  'use strict';

  const PROFILE = {
    graduationYear: '2027',
    degree: '本科',
    major: '英语',
    languages: ['英语'],
    targetCities: ['深圳','广州','上海','武汉','长沙','北京','杭州','苏州'],
    preferredDirections: ['GTM','PMO','项目管理','国际业务','海外业务','跨境电商','供应链','国际物流','产品运营','业务运营','品牌','内容运营','用户运营','商业分析','HRBP'],
    experiences: {
      astemo: ['项目进度','项目变更','变更审批','Gate评审','跨部门协同','项目节点','流程','职责梳理','项目管理','PMO','产品管理'],
      overseasRail: ['海外业务','英文资料','竞品分析','市场研究','业务布局','海外展会','客户信息','台账','国际业务','海外市场','GTM'],
      bilingualMuseum: ['双语','中英文讲解','跨文化','客户沟通','受众沟通','英文表达'],
      translation: ['翻译','本地化','术语','中英文稿件','质量控制','交付']
    }
  };

  const TITLE_DIRS = [
    ['HR·HRBP', /HRBP|人力资源|招聘运营|校园招聘|雇主品牌|人才发展|HR管培/i],
    ['国际物流·供应链管培', /国际物流|物流.*管培|物流商务|物流运营|供应链|采购管理|供应链管培/i],
    ['跨境电商运营', /跨境电商|电商运营|Amazon|TikTok\s*Shop|Shopee|独立站|DTC|店铺运营|平台运营/i],
    ['GTM·市场策略', /\bGTM\b|go[- ]?to[- ]?market|产品营销|产品市场|市场策略|品牌策略|全球营销/i],
    ['PMO·项目管理', /\bPMO\b|项目管理|项目运营|项目推进|项目协调|项目助理|项目经理/i],
    ['产品·业务运营', /产品运营|产品经理|产品管理|产品策划|业务运营/i],
    ['外贸·海外业务', /海外业务|国际业务|国际商务|海外商务|海外市场|海外运营|国际贸易|贸易运营|出海业务/i],
    ['品牌·内容·用户运营', /品牌运营|品牌营销|内容运营|社媒|KOL|SEO|新媒体|用户运营|用户增长|社区运营|品牌市场/i],
    ['经营·商业分析', /经营分析|商业分析|战略运营|经营管理|策略分析/i]
  ];

  const DIRS = [
    ['GTM·市场策略', /\bGTM\b|go[- ]?to[- ]?market|产品营销|产品市场|市场策略|品牌策略|全球营销/i],
    ['PMO·项目管理', /PMO|项目管理|项目运营|项目推进|项目协调|项目助理|项目经理/i],
    ['跨境电商运营', /跨境电商|电商运营|Amazon|TikTok\s*Shop|Shopee|独立站|DTC|店铺运营|平台运营/i],
    ['外贸·海外业务', /海外业务|国际业务|国际商务|海外商务|海外市场|海外运营|国际贸易|贸易运营|出海业务/i],
    ['国际物流·供应链管培', /国际物流|物流运营|供应链|采购管理|供应链管培|物流.*管培|物流商务/i],
    ['产品·业务运营', /产品运营|产品经理|产品管理|产品策划|业务运营/i],
    ['品牌·内容·用户运营', /品牌运营|品牌营销|内容运营|社媒|KOL|SEO|新媒体|用户运营|用户增长|社区运营|品牌市场/i],
    ['经营·商业分析', /经营分析|商业分析|战略运营|经营管理|策略分析/i],
    ['HR·HRBP', /HRBP|人力资源|招聘运营|校园招聘|雇主品牌|人才发展|HR管培/i],
    ['其他', /.*/i]
  ];

  const CITY_SCORE = {深圳:10,广州:9,上海:9,武汉:8,长沙:8,北京:7,杭州:7,苏州:7};
  const TECH_TITLE = /研发工程师|算法工程师|软件工程师|硬件工程师|机械工程师|电气工程师|结构工程师|测试工程师|实施工程师|开发工程师/i;
  const LOW_VALUE = /纯翻译|翻译专员|本地化|行政|文员|跟单|客服专员|销售代表|渠道销售|区域销售|纯销售/i;
  const SPECIALIST_NON_TARGET = /法务|财务|会计|审计|税务|EHS|安全工程|质量工程|临床|医学|律师/i;
  const INTERNATIONAL = /英语|英文|English|CET|海外|国际|全球|跨境|出海|GTM|跨文化|海外客户|国际客户/i;
  const MARKET_BUSINESS = /市场营销|国际商务|工商管理|广告|新闻传播|传播学|国际贸易|经济|金融|商业分析|供应链|物流管理|文科|社科/i;
  const STEM = /理工科|计算机|软件|电子|电气|机械|自动化|材料|数学|统计|数据科学|工业工程|物流工程/i;

  function uniq(arr){ return [...new Set((arr||[]).filter(Boolean).map(String))]; }
  function arr(v){ return Array.isArray(v) ? v : v ? [v] : []; }
  function evidence(job){
    const f=job.candidateFit||{};
    return uniq([
      ...arr(f.major&&f.major.evidence),
      ...arr(f.eligibilityEvidence),
      ...arr(f.responsibility&&f.responsibility.business),
      ...arr(f.responsibility&&f.responsibility.technical)
    ]);
  }
  function sourceText(job){
    return [
      job.title, job.description, job.city, job.company,
      ...arr(job.roleFamily), ...arr(job.skills), ...arr(job.languages),
      ...arr(job.experienceKeywords), ...arr(job.preferenceTags), ...arr(job.riskTags),
      ...evidence(job)
    ].filter(Boolean).join(' ');
  }

  function direction(job){
    const title=String(job.title||'');
    if(SPECIALIST_NON_TARGET.test(title)) return '其他';
    for(const [name,rx] of TITLE_DIRS){ if(rx.test(title)) return name; }
    const family=[...arr(job.roleFamily)].join(' ');
    for(const [name,rx] of DIRS){ if(name!=='其他' && rx.test(family)) return name; }
    const desc=String(job.description||'');
    for(const [name,rx] of DIRS){ if(rx.test(desc)) return name; }
    return '其他';
  }

  function isExpired(deadline, now=new Date()){
    if(!deadline) return false;
    const d=new Date(String(deadline).slice(0,10)+'T23:59:59+08:00');
    return !Number.isNaN(d.getTime()) && d < now;
  }

  function directJobUrl(url=''){
    return /detail|jobAdId|jobId|position|campus\/job|jobs\/|recruit/i.test(String(url));
  }

  function dataQuality(job){
    const ev=evidence(job), f=job.candidateFit||{}, desc=String(job.description||'');
    let score=0;
    const reasons=[];
    if(job.sourceType==='official'){ score+=3; reasons.push('官方招聘来源 +3'); }
    else if(job.sourceUrl){ score+=1; reasons.push('有可追溯来源 +1'); }
    if(job.sourceUrl){ score+=directJobUrl(job.sourceUrl)?2:1; reasons.push(directJobUrl(job.sourceUrl)?'可直达具体岗位 +2':'有来源链接 +1'); }
    if(arr(f.major&&f.major.evidence).length || arr(f.eligibilityEvidence).length){ score+=2; reasons.push('有专业/资格原文证据 +2'); }
    if(desc.length>=100 || arr(f.responsibility&&f.responsibility.business).length || arr(f.responsibility&&f.responsibility.technical).length){ score+=1; reasons.push('有职责信息 +1'); }
    if(job.deadline){ score+=1; reasons.push('有截止日期 +1'); }
    if(desc.length>=180 || ev.length>=3){ score+=1; reasons.push('JD信息较完整 +1'); }
    score=Math.min(10,score);

    let status=score>=7?'VALID':score>=4?'PARTIAL':'INVALID';
    const title=String(job.title||'');
    const obviousAggregate=/多个岗位|岗位合集|职位合集|岗位集合|职位集合|多岗位|招聘岗位如下/i.test(title+' '+desc);
    const genericSecondary=job.sourceType!=='official' && /^自动发现的/.test(desc) && !arr(f.major&&f.major.evidence).length && !arr(f.responsibility&&f.responsibility.business).length;
    if(!job.company || !job.title || !job.sourceUrl || obviousAggregate || genericSecondary) status='INVALID';
    return {score,status,reasons};
  }

  function alternativeLanguageSatisfied(t){
    const englishAlternative=/(英语|英文|English).{0,12}(或|\/|、|任选|任一|其中一种|至少一种).{0,12}(日语|日文|Japanese|西班牙语|西语|Spanish|德语|German|法语|French|韩语|Korean)/i.test(t)
      || /(日语|日文|Japanese|西班牙语|西语|Spanish|德语|German|法语|French|韩语|Korean).{0,12}(或|\/|、|任选|任一|其中一种|至少一种).{0,12}(英语|英文|English)/i.test(t);
    return englishAlternative;
  }

  function mandatorySmallLanguage(t){
    if(alternativeLanguageSatisfied(t)) return null;
    if(/(日语|日文|Japanese).{0,12}(N1|N2|工作语言|熟练|精通|必须|要求)|(必须|要求).{0,10}(日语|日文|Japanese)/i.test(t) && !/(优先|加分|更佳|preferred|plus)/i.test(t)) return '日语';
    if(/(西班牙语|西语|Spanish).{0,12}(工作语言|熟练|精通|必须|要求)|(必须|要求).{0,10}(西班牙语|西语|Spanish)/i.test(t) && !/(优先|加分|更佳|preferred|plus)/i.test(t)) return '西班牙语';
    if(/(德语|German).{0,12}(工作语言|熟练|精通|必须|要求)|(必须|要求).{0,10}(德语|German)/i.test(t) && !/(优先|加分|更佳|preferred|plus)/i.test(t)) return '德语';
    if(/(法语|French).{0,12}(工作语言|熟练|精通|必须|要求)|(必须|要求).{0,10}(法语|French)/i.test(t) && !/(优先|加分|更佳|preferred|plus)/i.test(t)) return '法语';
    if(/(韩语|Korean).{0,12}(TOPIK|工作语言|熟练|精通|必须|要求)|(必须|要求).{0,10}(韩语|Korean)/i.test(t) && !/(优先|加分|更佳|preferred|plus)/i.test(t)) return '韩语';
    return null;
  }

  function gate(job, now=new Date()){
    const t=sourceText(job), reasons=[];
    const year=String(job.graduationYear||'');
    if(year && !year.includes(PROFILE.graduationYear)) reasons.push('非2027届');
    if(isExpired(job.deadline,now)) reasons.push('岗位已截止');
    if(/实习|intern(ship)?/i.test(String(job.title||''))) reasons.push('实习岗位，不属于当前正式校招主池');

    const onlyMaster=/(面向|仅限|要求|须为).{0,20}(2027届)?应届?硕士毕业生|仅限硕士|硕士及以上|研究生及以上|硕士学历/i.test(t)
      && !/本科及以上|本科或硕士|本科、硕士|本科\/硕士|本科生和硕士/i.test(t);
    if(onlyMaster) reasons.push('学历要求为硕士/研究生，本科不满足');

    const stemMandatory=/(必须|仅限|要求).{0,15}(理工科|计算机|软件|电子|电气|机械|自动化|工程技术)|(理工科|计算机|工程技术).{0,12}(必须|仅限)/i.test(t);
    if(stemMandatory) reasons.push('专业硬门槛为理工/技术类');

    const hardTech=/(必须|熟练掌握|要求掌握|须具备).{0,12}(SQL|Python|Java|C\+\+|编程|数据库)/i.test(t)
      && !/(优先|加分|了解|熟悉者优先)/i.test(t);
    if(hardTech) reasons.push('存在必须的技术能力门槛');

    const lang=mandatorySmallLanguage(t);
    if(lang) reasons.push(`必须${lang}，当前英语画像不满足`);
    if(TECH_TITLE.test(String(job.title||''))) reasons.push('无关技术工程/实施岗位');
    return {passed:reasons.length===0,reasons};
  }

  function responsibilityScore(job, dir){
    const t=sourceText(job), title=String(job.title||'');
    let base={
      'GTM·市场策略':29,
      'PMO·项目管理':28,
      '跨境电商运营':27,
      '外贸·海外业务':27,
      '国际物流·供应链管培':24,
      '产品·业务运营':23,
      '品牌·内容·用户运营':23,
      '经营·商业分析':22,
      'HR·HRBP':19,
      '其他':14
    }[dir]||14;
    if(/项目推进|项目协调|Gate|变更|跨部门/.test(t) && dir==='PMO·项目管理') base=Math.min(30,base+2);
    if(/海外市场|市场策略|产品上市|go[- ]?to[- ]?market|竞品|市场洞察/i.test(t) && dir==='GTM·市场策略') base=Math.min(30,base+1);
    if(/用户|产品迭代|需求分析|产品规划|业务流程/.test(t) && dir==='产品·业务运营') base=Math.min(26,base+2);
    if(/销售跟单|订单跟进|客服|电话销售|纯销售|销售指标|陌拜/.test(t)) base=Math.min(base,12);
    if(LOW_VALUE.test(title)) base=Math.min(base,10);
    if(SPECIALIST_NON_TARGET.test(title)) base=Math.min(base,10);
    if(TECH_TITLE.test(title)) base=Math.min(base,5);
    return Math.max(0,Math.min(30,base));
  }

  function majorLanguageScore(job){
    const t=sourceText(job), ev=evidence(job).join(' ');
    let score=12;
    if(/专业不限|不限专业/.test(t)) score=19;
    else if(/英语专业|外语类|外国语言文学|语言类|翻译类/.test(t)) score=20;
    else if(MARKET_BUSINESS.test(ev||t)) score=16;
    if(STEM.test(ev) && !MARKET_BUSINESS.test(ev)) score=8;
    if(/理工.*优先|技术背景优先|计算机.*优先/.test(t)) score=Math.min(score,10);
    if(INTERNATIONAL.test(t)) score=Math.min(20,score+2);
    if(/英语.*工作语言|英文.*工作语言|英文沟通|英语沟通|海外客户|国际客户/.test(t)) score=Math.min(20,score+1);
    if(/小语种.*优先|日语.*优先|西语.*优先|德语.*优先|法语.*优先|韩语.*优先/.test(t)) score=Math.max(8,score-1);
    if(SPECIALIST_NON_TARGET.test(String(job.title||''))) score=Math.min(score,8);
    return Math.max(0,Math.min(20,score));
  }

  function countHits(t, words){ return words.filter(w=>t.includes(w)).length; }
  function experienceScore(job, dir){
    const t=sourceText(job);
    const ast=countHits(t,PROFILE.experiences.astemo);
    const rail=countHits(t,PROFILE.experiences.overseasRail);
    const museum=countHits(t,PROFILE.experiences.bilingualMuseum);
    const trans=countHits(t,PROFILE.experiences.translation);
    let score=8, direct=[];

    if(dir==='PMO·项目管理'){
      score=12+Math.min(11,ast*2)+Math.min(2,rail);
      if(ast>=3) direct.push('安斯泰莫：项目变更/Gate/跨部门协同直接对应');
    } else if(dir==='GTM·市场策略' || dir==='外贸·海外业务'){
      score=11+Math.min(11,rail*2)+Math.min(2,museum)+Math.min(2,trans);
      if(rail>=3) direct.push('中车海外事业部：竞品/海外市场/英文业务资料直接对应');
    } else if(dir==='跨境电商运营'){
      score=10+Math.min(8,rail*2)+Math.min(3,museum)+Math.min(3,trans);
      if(rail>=2) direct.push('中车海外业务经历可迁移到跨境业务场景');
    } else if(dir==='产品·业务运营'){
      score=10+Math.min(7,ast)+Math.min(4,rail)+Math.min(2,museum);
      if(ast>=3) direct.push('安斯泰莫产品管理/流程协同经历可迁移到产品与业务运营');
    } else if(dir==='品牌·内容·用户运营'){
      score=9+Math.min(6,rail)+Math.min(5,museum*2)+Math.min(5,trans*2);
      if(museum>=2||trans>=2) direct.push('双语讲解/翻译经历支持英文内容与用户沟通');
    } else if(dir==='国际物流·供应链管培'){
      score=10+Math.min(5,ast)+Math.min(7,rail);
      if(ast>=2||rail>=2) direct.push('项目协同与海外台账经历可迁移到供应链协同');
    } else if(dir==='经营·商业分析'){
      score=9+Math.min(6,rail)+Math.min(4,ast);
      if(rail>=2) direct.push('竞品与业务布局研究可迁移到商业分析');
    } else if(dir==='HR·HRBP'){
      score=8+Math.min(4,ast)+Math.min(3,museum);
    } else {
      score=8+Math.min(5,ast+rail+museum+trans);
    }
    return {score:Math.max(0,Math.min(25,score)),direct,strongDirect:direct.length>0,signals:{astemo:ast,overseasRail:rail,bilingualMuseum:museum,translation:trans}};
  }

  function careerValueScore(job,dir){
    let score={
      'GTM·市场策略':15,
      'PMO·项目管理':15,
      '外贸·海外业务':14,
      '跨境电商运营':14,
      '国际物流·供应链管培':13,
      '产品·业务运营':12,
      '品牌·内容·用户运营':12,
      '经营·商业分析':12,
      'HR·HRBP':9,
      '其他':6
    }[dir]||6;
    const t=sourceText(job);
    if(LOW_VALUE.test(String(job.title||'')) || /纯销售|销售跟单|行政文员/.test(t)) score=Math.min(score,4);
    if(SPECIALIST_NON_TARGET.test(String(job.title||''))) score=Math.min(score,4);
    return score;
  }

  function learnabilityScore(job){
    const t=sourceText(job);
    let score=7;
    if(/管培|培养|轮岗|导师|培训体系/.test(t)) score=10;
    if(/Excel|数据分析|市场分析/.test(t)) score=Math.max(score,8);
    if(/SQL|Python|编程/.test(t) && /(优先|加分|了解|熟悉者优先)/.test(t)) score=Math.min(score,6);
    if(/SQL|Python|编程/.test(t) && !/(优先|加分|了解|熟悉者优先)/.test(t)) score=Math.min(score,3);
    return Math.max(0,Math.min(10,score));
  }

  function risk(job){
    const t=sourceText(job), items=[];
    let deduction=0;
    function add(label,value){items.push({label,value});deduction+=value;}
    if(/长期驻外|长期派驻|长期海外|常驻海外|派驻.*海外|派驻.*非洲|驻外/.test(t)) add('长期派驻/驻外',15);
    if(/频繁出差|高频出差|大量出差|经常出差/.test(t)) add('高频出差',8);
    if(/销售KPI|销售指标|业绩指标|销售业绩/.test(t)) add('强销售KPI',10);
    if(/高压|高强度|节奏快|抗压能力强/.test(t)) add('高压/高强度',5);
    if(/SQL|Python|编程/.test(t) && /(优先|加分|了解|熟悉者优先)/.test(t)) add('关键技能需补足',8);
    const city=String(job.city||'');
    if(city && city!=='全国' && !PROFILE.targetCities.some(c=>city.includes(c))) add('城市非目标城市',5);
    return {deduction:Math.min(35,deduction),items};
  }

  function level(fit, parts, q, gateResult, exp){
    if(!gateResult.passed) return '不符合硬条件';
    if(q.status==='INVALID') return '数据待修复';
    if(fit>=92 && q.score>=8 && parts.responsibility>=27 && parts.majorLanguage>=16 && parts.experience>=21 && exp.strongDirect) return 'S++';
    if(fit>=85 && q.score>=7 && parts.responsibility>=25 && parts.majorLanguage>=12 && parts.experience>=15) return 'S';
    if(fit>=75) return 'A';
    if(fit>=65) return 'B';
    if(fit>=50) return 'C';
    return 'D';
  }

  function reasoning(job,dir,parts,exp,q,r,g){
    const reasons={};
    reasons.responsibility=`岗位归类为${dir}，职责适配 ${parts.responsibility}/30。`;
    reasons.major=`英语专业/语言场景适配 ${parts.majorLanguage}/20；硬门槛由Gate独立处理。`;
    reasons.experience=exp.direct.length?`${exp.direct.join('；')}，经历得分 ${parts.experience}/25。`:`未识别到强直接经历，仅按可迁移能力计分 ${parts.experience}/25。`;
    reasons.career=`职业方向价值 ${parts.careerValue}/15；以GTM、PMO、国际业务、跨境/供应链为优先。`;
    reasons.learnability=`可补足能力 ${parts.learnability}/10；非硬门槛技能缺口只降分，不替代Gate。`;
    reasons.dataQuality=`信息可信度 ${q.score}/10（${q.status}）。`;
    reasons.risk=r.items.length?r.items.map(x=>`${x.label} -${x.value}`).join('；'):'未识别明显偏好风险。';
    reasons.gate=g.passed?'硬条件通过。':`硬条件不通过：${g.reasons.join('；')}`;
    return reasons;
  }

  function evaluate(job,now=new Date()){
    const dir=direction(job), q=dataQuality(job), g=gate(job,now);
    const responsibility=responsibilityScore(job,dir);
    const majorLanguage=majorLanguageScore(job);
    const exp=experienceScore(job,dir);
    const careerValue=careerValueScore(job,dir);
    const learnability=learnabilityScore(job);
    const parts={responsibility,majorLanguage,experience:exp.score,careerValue,learnability};
    const fit=Math.max(0,Math.min(100,Object.values(parts).reduce((a,b)=>a+b,0)));
    const r=risk(job);
    const priority=Math.max(0,Math.min(100,fit-r.deduction));
    const lvl=level(fit,parts,q,g,exp);
    return {
      direction:dir,
      gate:g,
      fit:{score:fit,parts},
      dataQuality:q,
      risk:r,
      priorityScore:priority,
      level:lvl,
      experienceEvidence:exp,
      reasoning:reasoning(job,dir,parts,exp,q,r,g)
    };
  }

  const LEVEL_RANK={'S++':7,'S':6,'A':5,'B':4,'C':3,'D':2,'不符合硬条件':1,'数据待修复':0};
  function compare(a,b){
    const ea=a._evaluation||evaluate(a), eb=b._evaluation||evaluate(b);
    if(ea.gate.passed!==eb.gate.passed) return eb.gate.passed-ea.gate.passed;
    const qr={VALID:3,PARTIAL:2,INVALID:1};
    if(qr[ea.dataQuality.status]!==qr[eb.dataQuality.status]) return qr[eb.dataQuality.status]-qr[ea.dataQuality.status];
    if((LEVEL_RANK[ea.level]||0)!==(LEVEL_RANK[eb.level]||0)) return (LEVEL_RANK[eb.level]||0)-(LEVEL_RANK[ea.level]||0);
    if(ea.priorityScore!==eb.priorityScore) return eb.priorityScore-ea.priorityScore;
    if(ea.fit.score!==eb.fit.score) return eb.fit.score-ea.fit.score;
    if((a.sourceType==='official')!==(b.sourceType==='official')) return b.sourceType==='official'?1:-1;
    return String(b.publishedAt||'').localeCompare(String(a.publishedAt||''));
  }

  const api={PROFILE,evaluate,compare,direction,dataQuality,gate,mandatorySmallLanguage,alternativeLanguageSatisfied,isExpired};
  root.CampusScoring=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

// ===== V1.1 language patch (was scoring-v1.1-language-patch.js) =====
(function(root){
  'use strict';
  const S=root.CampusScoring;
  if(!S) throw new Error('CampusScoring v1.1 must load before language patch');

  const oldEvaluate=S.evaluate;
  const oldGate=S.gate;

  const LANGS=[
    ['日语',/(日语|日文|Japanese)/i,/(N1|N2|JLPT)/i],
    ['西班牙语',/(西班牙语|西语|Spanish)/i,null],
    ['德语',/(德语|German)/i,/(TestDaF|DSH)/i],
    ['法语',/(法语|French)/i,/(DELF|DALF)/i],
    ['韩语',/(韩语|Korean)/i,/(TOPIK)/i],
    ['葡萄牙语',/(葡萄牙语|葡语|Portuguese)/i,null],
    ['俄语',/(俄语|Russian)/i,null],
    ['意大利语',/(意大利语|Italian)/i,null],
    ['阿拉伯语',/(阿拉伯语|Arabic)/i,null],
    ['泰语',/(泰语|Thai)/i,null],
    ['越南语',/(越南语|Vietnamese)/i,null],
    ['印尼语',/(印尼语|印尼文|Bahasa Indonesia|Indonesian)/i,null],
    ['马来语',/(马来语|Malay)/i,null],
    ['瑞典语',/(瑞典语|Swedish)/i,null],
    ['荷兰语',/(荷兰语|Dutch)/i,null],
    ['波兰语',/(波兰语|Polish)/i,null],
    ['土耳其语',/(土耳其语|Turkish)/i,null]
  ];

  function arr(v){return Array.isArray(v)?v:v?[v]:[]}
  function sourceText(job){
    const f=job.candidateFit||{};
    return [job.title,job.description,job.city,job.company,...arr(job.roleFamily),...arr(job.skills),...arr(job.languages),...arr(job.experienceKeywords),...arr(job.preferenceTags),...arr(job.riskTags),...arr(f.major&&f.major.evidence),...arr(f.eligibilityEvidence),...arr(f.responsibility&&f.responsibility.business),...arr(f.responsibility&&f.responsibility.technical)].filter(Boolean).join(' ');
  }
  function clauses(t){return String(t||'').split(/[。；;，,\n]/).map(x=>x.trim()).filter(Boolean)}
  function alternativesSatisfied(t){
    return /(英语|英文|English).{0,16}(或|\/|任选|任一|其中一种|至少一种).{0,16}(日语|日文|Japanese|西班牙语|西语|Spanish|德语|German|法语|French|韩语|Korean|葡萄牙语|葡语|Portuguese|俄语|Russian|意大利语|Italian|阿拉伯语|Arabic|泰语|Thai|越南语|Vietnamese|印尼语|Indonesian|马来语|Malay|瑞典语|Swedish|荷兰语|Dutch|波兰语|Polish|土耳其语|Turkish)/i.test(t)
      || /(日语|日文|Japanese|西班牙语|西语|Spanish|德语|German|法语|French|韩语|Korean|葡萄牙语|葡语|Portuguese|俄语|Russian|意大利语|Italian|阿拉伯语|Arabic|泰语|Thai|越南语|Vietnamese|印尼语|Indonesian|马来语|Malay|瑞典语|Swedish|荷兰语|Dutch|波兰语|Polish|土耳其语|Turkish).{0,16}(或|\/|任选|任一|其中一种|至少一种).{0,16}(英语|英文|English)/i.test(t);
  }
  function mandatorySmallLanguage(t){
    t=String(t||'');
    if(alternativesSatisfied(t)) return null;
    for(const clause of clauses(t)){
      for(const [name,langRx,certRx] of LANGS){
        if(!langRx.test(clause)) continue;
        const preferred=/(优先|加分|更佳|preferred|plus)/i.test(clause);
        const explicit=/(必须|要求|需具备|须具备|应具备|可作为工作语言|工作语言|熟练|精通)/i.test(clause);
        const cert=certRx&&certRx.test(clause);
        if((explicit||cert)&&!preferred) return name;
      }
    }
    return null;
  }
  function languageSpecificTitle(title){
    title=String(title||'');
    for(const [name,langRx] of LANGS){
      if(new RegExp(`[（(][^）)]*${langRx.source}[^）)]*[）)]`,langRx.flags).test(title)) return name;
      if(new RegExp(`(?:-|—|\\s)${langRx.source}(?:-|—|\\s|$)`,langRx.flags).test(title)) return name;
      if(new RegExp(`(?:-|—|·|\\s)${langRx.source}(?=[（(、，,]|$)`,langRx.flags).test(title)) return name;
    }
    return null;
  }
  function bachelorExplicitlyAllowed(text){
    return /本科及以上|本科以上|本科或硕士|本科、硕士|本科\/硕士|本科生和硕士|本科\/硕士\/博士|本科、硕士、博士|本科生、硕士生、博士生|本科生及以上/i.test(String(text||''));
  }
  function advancedDegreeRequired(t,title=''){
    title=String(title||'');
    if(/硕士|博士/.test(title) && !/本科/.test(title)) return true;
    for(const clause of clauses(t)){
      if(bachelorExplicitlyAllowed(clause)) continue;
      const advanced=/(博士毕业生|应届博士|仅限博士|博士及以上|博士学历|须为博士|要求博士|面向博士|硕士毕业生|应届硕士|仅限硕士|硕士及以上|研究生及以上|硕士学历|须为硕士|要求硕士|面向硕士)/i.test(clause);
      const preferred=/(硕士优先|博士优先|研究生优先)/i.test(clause);
      if(advanced&&!preferred) return true;
    }
    return false;
  }
  function hardTechRequired(t){
    for(const clause of clauses(t)){
      if(!/(SQL|Python|Java|C\+\+|编程|数据库)/i.test(clause)) continue;
      const preferred=/(优先|加分|了解|熟悉者优先)/i.test(clause);
      const required=/(必须|熟练掌握|要求掌握|须具备|需具备|应具备|精通)/i.test(clause);
      if(required&&!preferred) return true;
    }
    return false;
  }
  function explicitNon2027Title(title){
    title=String(title||'');
    if(/2027/.test(title)) return false;
    return /(2025|2026)(届|年)?[^\n]{0,8}(校招|校园招聘)|20(25|26)届/i.test(title);
  }
  function gate(job,now=new Date()){
    const old=oldGate(job,now),t=sourceText(job);
    const reasons=old.reasons.filter(x=>
      !/^必须.+当前英语画像不满足$/.test(x) &&
      x!=='学历要求为硕士/研究生，本科不满足' &&
      x!=='存在必须的技术能力门槛'
    );
    if(explicitNon2027Title(job.title)) reasons.push('岗位标题明确为非2027届');
    if(advancedDegreeRequired(t,job.title)) reasons.push('仅招硕士/博士，本科学历不满足');
    if(hardTechRequired(t)) reasons.push('存在必须的技术能力门槛');
    const titleLang=languageSpecificTitle(job.title);
    if(titleLang&&!alternativesSatisfied(String(job.title||''))&&!/优先|加分|优势|更佳|preferred|plus/i.test(String(job.title||''))) reasons.push(`岗位标题限定${titleLang}，当前英语画像不满足`);
    const lang=mandatorySmallLanguage(t);
    if(lang) reasons.push(`必须${lang}，当前英语画像不满足`);
    return {passed:reasons.length===0,reasons:[...new Set(reasons)]};
  }
  function recalcLevel(base,g){
    if(!g.passed) return '不符合硬条件';
    if(base.dataQuality.status==='INVALID') return '数据待修复';
    const p=base.fit.parts,e=base.experienceEvidence;
    if(base.fit.score>=92&&base.dataQuality.score>=8&&p.responsibility>=27&&p.majorLanguage>=16&&p.experience>=21&&e.strongDirect)return'S++';
    if(base.fit.score>=85&&base.dataQuality.score>=7&&p.responsibility>=25&&p.majorLanguage>=12&&p.experience>=15)return'S';
    if(base.fit.score>=75)return'A';
    if(base.fit.score>=65)return'B';
    if(base.fit.score>=50)return'C';
    return'D';
  }
  function evaluate(job,now=new Date()){
    const base=oldEvaluate(job,now),g=gate(job,now);
    base.gate=g;
    base.level=recalcLevel(base,g);
    base.reasoning.gate=g.passed?'硬条件通过。':`硬条件不通过：${g.reasons.join('；')}`;
    return base;
  }

  S.alternativeLanguageSatisfied=alternativesSatisfied;
  S.mandatorySmallLanguage=mandatorySmallLanguage;
  S.languageSpecificTitle=languageSpecificTitle;
  S.explicitNon2027Title=explicitNon2027Title;
  S.bachelorExplicitlyAllowed=bachelorExplicitlyAllowed;
  S.advancedDegreeRequired=advancedDegreeRequired;
  S.gate=gate;
  S.evaluate=evaluate;
})(typeof globalThis!=='undefined'?globalThis:this);

// ===== V1.2 calibration patch (was scoring-v1.2-calibration-patch.js) =====
(function(root){
  'use strict';
  const S=root.CampusScoring;
  if(!S) throw new Error('CampusScoring v1.1 must load before V1.2 calibration patch');

  const oldEvaluate=S.evaluate;

  const LEVEL_RANK={'S++':6,'S':5,'A':4,'B':3,'C':2,'D':1,'不符合硬条件':0,'数据待修复':-1};
  const FOREIGN_CITY_RX=/(国外|Germany|Netherlands|Mexico|Philippines|Dubai|Brazil|Canada|Sweden|Seattle|United States|USA|\bUS\b|Turkey|United Kingdom|\bUK\b|France|Spain|Italy|Japan|Korea|Thailand|Vietnam|Indonesia|Malaysia|Singapore|Australia|New Zealand|Poland|Czech|Hungary|Romania|UAE|Saudi|India|Chile|Peru|Colombia|Argentina|South Africa|Egypt|Kenya|Nigeria|德国|荷兰|墨西哥|菲律宾|迪拜|巴西|加拿大|瑞典|美国|土耳其|英国|法国|西班牙|意大利|日本|韩国|泰国|越南|印尼|马来西亚|新加坡|澳大利亚|新西兰|波兰|捷克|匈牙利|罗马尼亚|阿联酋|沙特|印度|智利|秘鲁|哥伦比亚|阿根廷|南非|埃及|肯尼亚|尼日利亚|杜塞尔多夫|鹿特丹|墨西哥城|马尼拉|圣保罗|温哥华|松德比贝里|西雅图|巴尔韦伦)/i;
  const EXPLICIT_FOREIGN_TITLE_RX=/(?:-|–|—|\(|（)\s*(Germany|Netherlands|Mexico|Philippines|Dubai|Brazil|Canada|Sweden|Seattle|US|USA|Turkey|UK|France|Spain|Italy|Japan|Korea|Thailand|Vietnam|Indonesia|Malaysia|Singapore|Australia|New Zealand|Poland|Czech|Hungary|Romania|UAE|Saudi|India|德国|荷兰|墨西哥|菲律宾|迪拜|巴西|加拿大|瑞典|美国|土耳其|英国|法国|西班牙|意大利|日本|韩国|泰国|越南|印尼|马来西亚|新加坡|澳大利亚|新西兰)\s*(?:\)|）|$)|(?:工作地|工作地点|base|location)\s*[:：]?\s*(国外|海外|Germany|Netherlands|Mexico|Philippines|Dubai|Brazil|Canada|Sweden|US|USA|Turkey|UK|France|Spain|Italy|Japan|Korea|Thailand|Vietnam|Singapore)/i;

  function foreignWorkLocation(job){
    const city=String(job.city||'').trim();
    const title=String(job.title||'').trim();
    if(city && !/^(待核|未知|全国|不限|-)$/.test(city)) return FOREIGN_CITY_RX.test(city);
    return EXPLICIT_FOREIGN_TITLE_RX.test(title);
  }

  function implausibleDeadline(deadline){
    if(!deadline) return false;
    const m=String(deadline).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!m) return false;
    return Number(m[1])>2027;
  }

  function fitLevelFromBase(base){
    if(!base.gate.passed) return '不符合硬条件';
    if(base.dataQuality.status==='INVALID') return '数据待修复';
    return base.level;
  }

  function recommendationByPriority(base){
    if(!base.gate.passed) return '不符合硬条件';
    if(base.dataQuality.status==='INVALID') return '数据待修复';

    let candidate;
    const p=base.priorityScore;
    if(p>=92) candidate='S++';
    else if(p>=85) candidate='S';
    else if(p>=75) candidate='A';
    else if(p>=65) candidate='B';
    else if(p>=50) candidate='C';
    else candidate='D';

    const fitLevel=base.fitLevel;
    if((LEVEL_RANK[candidate]||0)>(LEVEL_RANK[fitLevel]||0)) candidate=fitLevel;
    if(base.dataQuality.status==='PARTIAL' && (LEVEL_RANK[candidate]||0)>LEVEL_RANK.B) candidate='B';
    return candidate;
  }

  function patchRisk(base,job){
    const items=(base.risk&&Array.isArray(base.risk.items)?base.risk.items:[]).map(x=>({...x}));
    let deduction=Number(base.risk&&base.risk.deduction||0);
    if(foreignWorkLocation(job)){
      let hasOverseas=false;
      for(let i=items.length-1;i>=0;i--){
        const label=String(items[i].label||'');
        if(/长期派驻|长期驻外|长期海外|海外工作地点/.test(label)) hasOverseas=true;
        if(label==='城市非目标城市'){
          deduction-=Number(items[i].value||0);
          items.splice(i,1);
        }
      }
      if(!hasOverseas){
        items.push({label:'长期海外工作地点',value:15});
        deduction+=15;
      }
    }
    deduction=Math.max(0,Math.min(35,deduction));
    base.risk={deduction,items};
    base.priorityScore=Math.max(0,Math.min(100,base.fit.score-deduction));
  }

  function patchDataQuality(base,job){
    if(implausibleDeadline(job.deadline) && base.dataQuality.status!=='INVALID'){
      base.dataQuality={...base.dataQuality,status:'PARTIAL',reasons:[...(base.dataQuality.reasons||[]),'截止日期异常，需回官网核验']};
    }
  }

  function evaluate(job,now=new Date()){
    const base=oldEvaluate(job,now);
    base.fitLevel=fitLevelFromBase(base);
    patchRisk(base,job);
    patchDataQuality(base,job);
    base.recommendationLevel=recommendationByPriority(base);
    base.level=base.recommendationLevel;
    if(base.reasoning){
      base.reasoning.risk=base.risk.items.length?base.risk.items.map(x=>`${x.label} -${x.value}`).join('；'):'未识别明显偏好风险。';
      base.reasoning.dataQuality=`信息可信度 ${base.dataQuality.score}/10（${base.dataQuality.status}）。`;
      base.reasoning.recommendation=`适配等级 ${base.fitLevel}；风险调整后优先分 ${base.priorityScore}；最终推荐 ${base.recommendationLevel}${base.dataQuality.status==='PARTIAL'?'（待核，上限B）':''}。`;
    }
    return base;
  }

  function compare(a,b){
    const ea=a._evaluation||evaluate(a), eb=b._evaluation||evaluate(b);
    if(ea.gate.passed!==eb.gate.passed) return eb.gate.passed-ea.gate.passed;
    const qr={VALID:3,PARTIAL:2,INVALID:1};
    if(qr[ea.dataQuality.status]!==qr[eb.dataQuality.status]) return qr[eb.dataQuality.status]-qr[ea.dataQuality.status];
    if((LEVEL_RANK[ea.level]||0)!==(LEVEL_RANK[eb.level]||0)) return (LEVEL_RANK[eb.level]||0)-(LEVEL_RANK[ea.level]||0);
    if(ea.priorityScore!==eb.priorityScore) return eb.priorityScore-ea.priorityScore;
    if(ea.fit.score!==eb.fit.score) return eb.fit.score-ea.fit.score;
    if((a.sourceType==='official')!==(b.sourceType==='official')) return b.sourceType==='official'?1:-1;
    return String(b.publishedAt||'').localeCompare(String(a.publishedAt||''));
  }

  S.foreignWorkLocation=foreignWorkLocation;
  S.implausibleDeadline=implausibleDeadline;
  S.evaluate=evaluate;
  S.compare=compare;
})(typeof globalThis!=='undefined'?globalThis:this);

// ===== V1.3 quality patch (was scoring-v1.3-quality-patch.js) =====
(function(root){
  'use strict';
  const S=root.CampusScoring;
  if(!S?.evaluate) throw new Error('CampusScoring V1.2 must load before V1.3 quality patch');

  const oldEvaluate=S.evaluate;
  const oldCompare=S.compare;
  const BAD_COMPANY_EXACT=/^(?:待核公司|就业办\d*|就业办|就业处|就业指导中心|就业创业中心|招生就业处|招生就业办|学生就业|学生工作处|人才服务中心|毕业生就业|通知|公告|邀请函|就业补贴|求职补贴|一次性求职补贴)$/i;
  const BAD_COMPANY_START=/^(?:关于做好|关于开展|关于组织|感谢贵单位|尊敬的用人单位|各用人单位|各学院|各位同学|就业办\d*|就业处|就业指导中心|就业创业中心|招生就业处|招生就业办)/i;
  const BAD_COMPANY_CONTAINS=/(?:毕业生一次性求职补贴|求职补贴申报|就业创业工作的大力支持|工商查询\s*$)/i;

  function suspiciousCompany(job={}){
    const company=String(job.company||'').replace(/\s+/g,' ').trim();
    if(!company) return '公司名称缺失';
    if(BAD_COMPANY_EXACT.test(company)||BAD_COMPANY_START.test(company)||BAD_COMPANY_CONTAINS.test(company)) return '公司字段疑似高校就业通知/占位文本';
    const school=String(job.universitySource?.school||'').replace(/\s+/g,'').trim();
    if(school&&company.replace(/\s+/g,'')===school) return '公司字段误取高校名称';
    if(company.length>60) return '公司名称异常过长，疑似正文误抽取';
    return '';
  }

  function evaluate(job,now=new Date()){
    const result=oldEvaluate(job,now);
    const issue=suspiciousCompany(job);
    if(!issue) return result;
    result.dataQuality={
      ...(result.dataQuality||{}),
      status:'INVALID',
      reasons:[...new Set([...(result.dataQuality?.reasons||[]),issue])]
    };
    result.recommendationLevel='数据待修复';
    result.level='数据待修复';
    if(result.reasoning){
      result.reasoning.dataQuality=`${result.reasoning.dataQuality||''} ${issue}；该记录不进入正常 S/A/B 推荐。`.trim();
      result.reasoning.recommendation='数据实体校验未通过，进入数据修复队列，不参与正常推荐排序。';
    }
    return result;
  }

  function compare(a,b){
    if(a?._evaluation&&b?._evaluation) return oldCompare(a,b);
    const aa=a?._evaluation? a : {...a,_evaluation:evaluate(a)};
    const bb=b?._evaluation? b : {...b,_evaluation:evaluate(b)};
    return oldCompare(aa,bb);
  }

  S.suspiciousCompany=suspiciousCompany;
  S.evaluate=evaluate;
  S.compare=compare;
})(typeof globalThis!=='undefined'?globalThis:this);
