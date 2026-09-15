(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root){
    root.BoardLogicCorrectness=api;
    if(root.CampusScoring) api.patchScoring(root.CampusScoring);
    if(root.document) api.installUiFixes(root.document);
  }
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const VERSION='1.0';
  const LEVEL_RANK={'S++':7,'S':6,'A':5,'B':4,'C':3,'D':2,'不符合硬条件':1,'数据待修复':0};
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
  const ENGLISH=/(英语|英文|English)/i;
  const ALT_CONNECTOR=/(或|\/|任选|任一|其中一种|至少一种|二选一|均可)/i;
  const PREFERRED=/(优先|加分|优势|更佳|preferred|plus)/i;

  const arr=v=>Array.isArray(v)?v:v?[v]:[];
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  function clauses(text){return String(text||'').split(/[。；;，,\n]/).map(x=>x.trim()).filter(Boolean);}
  function candidateEvidence(job={}){
    const f=job.candidateFit||{};
    return [
      ...arr(f.major&&f.major.evidence),
      ...arr(f.eligibilityEvidence),
      ...arr(f.responsibility&&f.responsibility.business),
      ...arr(f.responsibility&&f.responsibility.technical)
    ];
  }
  function fullGateText(job={}){
    return [
      job.title,job.description,job.jobDescription,job.jobRequirements,job.city,job.company,
      ...arr(job.roleFamily),...arr(job.skills),...arr(job.languages),...arr(job.experienceKeywords),
      ...arr(job.preferenceTags),...arr(job.riskTags),...candidateEvidence(job)
    ].filter(Boolean).join(' ');
  }
  function explicit2027(job={}){
    const year=String(job.graduationYear||'');
    if(/2027/.test(year)) return true;
    const text=[job.title,job.description,job.jobDescription,job.jobRequirements,...candidateEvidence(job)].filter(Boolean).join(' ');
    return /2027\s*(届|年(?:应届|毕业|校园招聘|校招))|2027(?:校园招聘|校招)/i.test(text);
  }
  function explicitNon2027Title(title=''){
    title=String(title||'');
    if(/2027/.test(title)) return false;
    return /(2025|2026)(届|年)?[^\n]{0,10}(校招|校园招聘)|20(25|26)届|25\/26(可投|届)?|往届(可投|毕业生)?|2025-2026/i.test(title);
  }
  function bachelorExplicitlyAllowed(text=''){
    return /本科及以上|本科以上|本科或硕士|本科、硕士|本科\/硕士|本科生和硕士|本科\/硕士\/博士|本科、硕士、博士|本科生、硕士生、博士生|本科生及以上/i.test(String(text||''));
  }
  function advancedDegreeRequired(text='',title=''){
    const t=String(title||'');
    const titleHard=/(仅限|只招|限招).{0,6}(硕士|博士)|(硕士|博士).{0,4}(及以上|岗位|专场)|研究生及以上/i.test(t);
    if(titleHard&&!PREFERRED.test(t)&&!bachelorExplicitlyAllowed(t)) return true;
    for(const clause of clauses(text)){
      if(bachelorExplicitlyAllowed(clause)||PREFERRED.test(clause)) continue;
      if(/(博士毕业生|应届博士|仅限博士|博士及以上|博士学历|须为博士|要求博士|面向博士|硕士.{0,4}毕业生|应届硕士|仅限硕士|硕士及以上|研究生及以上|硕士研究生学位及以上|硕士研究生及以上|硕士.{0,4}学历|须为硕士|要求硕士|面向硕士)/i.test(clause)) return true;
    }
    return false;
  }
  function hardTechRequired(text=''){
    for(const clause of clauses(text)){
      if(!/(SQL|Python|Java|C\+\+|编程|数据库)/i.test(clause)) continue;
      if(PREFERRED.test(clause)) continue;
      if(/(必须|熟练掌握|要求掌握|须具备|需具备|应具备|精通|必须掌握)/i.test(clause)) return true;
    }
    return false;
  }
  function alternativeInSameClause(clause,langRx){
    return ENGLISH.test(clause)&&langRx.test(clause)&&ALT_CONNECTOR.test(clause);
  }
  function mandatorySmallLanguage(text=''){
    for(const clause of clauses(text)){
      for(const [name,langRx,certRx] of LANGS){
        if(!langRx.test(clause)) continue;
        if(PREFERRED.test(clause)||alternativeInSameClause(clause,langRx)) continue;
        const explicit=/(必须|要求|需具备|须具备|应具备|可作为工作语言|工作语言|熟练|精通)/i.test(clause);
        const cert=Boolean(certRx&&certRx.test(clause));
        if(explicit||cert) return name;
      }
    }
    return null;
  }
  function languageSpecificTitle(title=''){
    const t=String(title||'');
    for(const [name,langRx] of LANGS){
      if(new RegExp(`[（(][^）)]*${langRx.source}[^）)]*[）)]`,langRx.flags).test(t)) return name;
      if(new RegExp(`(?:-|—|·|\\s)${langRx.source}(?=[（(、，,\\s]|$)`,langRx.flags).test(t)) return name;
    }
    return null;
  }
  function titleLanguageAllowed(title='',langName=''){
    const row=LANGS.find(x=>x[0]===langName);
    if(!row) return false;
    return PREFERRED.test(title)||alternativeInSameClause(String(title),row[1]);
  }
  function baseReasons(oldGate,job,now){
    if(typeof oldGate!=='function') return [];
    try{return arr(oldGate(job,now)?.reasons);}catch{return [];}
  }
  function strictGate(job={},now=new Date(),oldGate){
    const text=fullGateText(job);
    const reasons=baseReasons(oldGate,job,now).filter(reason=>{
      const r=String(reason||'');
      return !(
        r==='非2027届'||/岗位标题明确为非2027届|缺少明确2027届/.test(r)||
        /^必须.+当前英语画像不满足$/.test(r)||/岗位标题限定.+当前英语画像不满足/.test(r)||
        /学历要求为硕士|仅招硕士|硕士\/博士|本科学历不满足/.test(r)||
        r==='存在必须的技术能力门槛'
      );
    });

    const year=String(job.graduationYear||'');
    if(year&&!/2027/.test(year)) reasons.push('非2027届');
    else if(!explicit2027(job)) reasons.push('缺少明确2027届招聘证据');
    if(explicitNon2027Title(job.title)) reasons.push('岗位标题明确为非2027届');
    if(advancedDegreeRequired(text,job.title)) reasons.push('仅招硕士/博士，本科学历不满足');
    if(hardTechRequired(text)) reasons.push('存在必须的技术能力门槛');

    const titleLang=languageSpecificTitle(job.title);
    if(titleLang&&!titleLanguageAllowed(job.title,titleLang)) reasons.push(`岗位标题限定${titleLang}，当前英语画像不满足`);
    const lang=mandatorySmallLanguage(text);
    if(lang) reasons.push(`必须${lang}，当前英语画像不满足`);
    return {passed:reasons.length===0,reasons:uniq(reasons)};
  }
  function fitLevel(result,job,scoring){
    if(!result.gate?.passed) return '不符合硬条件';
    if(result.dataQuality?.status==='INVALID') return '数据待修复';
    const p=result.fit?.parts||{},e=result.experienceEvidence||{},fit=Number(result.fit?.score||0);
    if(fit>=92&&(result.dataQuality?.score||0)>=8&&(p.responsibility||0)>=27&&(p.majorLanguage||0)>=16&&(p.experience||0)>=21&&e.strongDirect) return 'S++';
    if(fit>=85&&(result.dataQuality?.score||0)>=7&&(p.responsibility||0)>=25&&(p.majorLanguage||0)>=16&&(p.experience||0)>=18&&e.strongDirect) return 'S';
    if(fit>=75){
      if(result.direction==='PMO·项目管理'&&scoring?.pmoHasEnglishSignal&&!scoring.pmoHasEnglishSignal(job)) return 'B';
      return 'A';
    }
    if(fit>=65) return 'B';
    if(fit>=50) return 'C';
    return 'D';
  }
  function recommendationLevel(result,fitLvl){
    if(!result.gate?.passed) return '不符合硬条件';
    if(result.dataQuality?.status==='INVALID') return '数据待修复';
    const p=Number(result.priorityScore||0);
    let level=p>=92?'S++':p>=85?'S':p>=75?'A':p>=65?'B':p>=50?'C':'D';
    if((LEVEL_RANK[level]||0)>(LEVEL_RANK[fitLvl]||0)) level=fitLvl;
    if(result.dataQuality?.status==='PARTIAL'&&(LEVEL_RANK[level]||0)>LEVEL_RANK.B) level='B';
    return level;
  }
  function patchScoring(scoring){
    if(!scoring?.evaluate||scoring.__logicCorrectnessV1) return scoring;
    const oldEvaluate=scoring.evaluate.bind(scoring);
    const oldGate=typeof scoring.gate==='function'?scoring.gate.bind(scoring):null;
    const oldCompare=typeof scoring.compare==='function'?scoring.compare.bind(scoring):null;

    scoring.gate=function(job,now){return strictGate(job,now,oldGate);};
    scoring.evaluate=function(job,now){
      const result=oldEvaluate(job,now);
      result.gate=strictGate(job,now,oldGate);
      result.fitLevel=fitLevel(result,job,scoring);
      result.recommendationLevel=recommendationLevel(result,result.fitLevel);
      result.level=result.recommendationLevel;
      result.reasoning=result.reasoning||{};
      result.reasoning.gate=result.gate.passed?'硬条件通过。':`硬条件不通过：${result.gate.reasons.join('；')}`;
      result.reasoning.recommendation=`适配等级 ${result.fitLevel}；风险调整后优先分 ${result.priorityScore}；最终推荐 ${result.recommendationLevel}${result.dataQuality?.status==='PARTIAL'?'（待核，上限B）':''}。`;
      return result;
    };
    if(oldCompare){
      scoring.compare=function(a,b){
        const aa=a?._evaluation?a:{...a,_evaluation:scoring.evaluate(a)};
        const bb=b?._evaluation?b:{...b,_evaluation:scoring.evaluate(b)};
        return oldCompare(aa,bb);
      };
    }
    scoring.strictEligibilityGate=strictGate;
    scoring.fullGateText=fullGateText;
    scoring.explicit2027=explicit2027;
    scoring.directJobUrl=directJobUrl;
    scoring.__logicCorrectnessV1=VERSION;
    return scoring;
  }
  function directJobUrl(url=''){
    const u=String(url||'');
    if(!u) return false;
    if(/[?&](?:jobId|jobAdId|positionId|position_id|job_id|jobCode|positionCode|recruitmentId)=/i.test(u)) return true;
    if(/\/(?:jobs?|positions?|jobdetails?|job-detail|position-detail|campus\/job)\/[^/?#]+/i.test(u)) return true;
    if(/\/detail(?:\/|[?#])/i.test(u)) return true;
    if(/#\/(?:jobs?|positions?)\/[^/?#]+/i.test(u)) return true;
    return false;
  }
  function fixApplyLinks(doc){
    if(!doc?.querySelectorAll) return;
    doc.querySelectorAll('a.btn.primary[href]').forEach(a=>{
      const href=a.getAttribute('href')||'';
      if(!directJobUrl(href)&&String(a.textContent||'').trim()==='立即投递'){
        a.textContent='查看官网';
        a.setAttribute('title','该链接为官方招聘入口，不是已确认的具体岗位详情页');
      }
    });
  }
  function installUiFixes(doc){
    fixApplyLinks(doc);
    if(typeof MutationObserver==='function'&&doc?.body){
      const observer=new MutationObserver(()=>fixApplyLinks(doc));
      observer.observe(doc.body,{childList:true,subtree:true});
      return observer;
    }
    return null;
  }

  return {VERSION,fullGateText,explicit2027,explicitNon2027Title,advancedDegreeRequired,hardTechRequired,mandatorySmallLanguage,languageSpecificTitle,strictGate,fitLevel,recommendationLevel,directJobUrl,patchScoring,fixApplyLinks,installUiFixes};
});