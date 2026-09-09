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
    ['马来语',/(马来语|Malay)/i,null]
  ];

  function arr(v){return Array.isArray(v)?v:v?[v]:[]}
  function sourceText(job){
    const f=job.candidateFit||{};
    return [job.title,job.description,job.city,job.company,...arr(job.roleFamily),...arr(job.skills),...arr(job.languages),...arr(job.experienceKeywords),...arr(job.preferenceTags),...arr(job.riskTags),...arr(f.major&&f.major.evidence),...arr(f.eligibilityEvidence),...arr(f.responsibility&&f.responsibility.business),...arr(f.responsibility&&f.responsibility.technical)].filter(Boolean).join(' ');
  }
  function clauses(t){return String(t||'').split(/[。；;，,\n]/).map(x=>x.trim()).filter(Boolean)}
  function alternativesSatisfied(t){
    return /(英语|英文|English).{0,16}(或|\/|任选|任一|其中一种|至少一种).{0,16}(日语|日文|Japanese|西班牙语|西语|Spanish|德语|German|法语|French|韩语|Korean|葡萄牙语|葡语|Portuguese|俄语|Russian|意大利语|Italian|阿拉伯语|Arabic|泰语|Thai|越南语|Vietnamese|印尼语|Indonesian|马来语|Malay)/i.test(t)
      || /(日语|日文|Japanese|西班牙语|西语|Spanish|德语|German|法语|French|韩语|Korean|葡萄牙语|葡语|Portuguese|俄语|Russian|意大利语|Italian|阿拉伯语|Arabic|泰语|Thai|越南语|Vietnamese|印尼语|Indonesian|马来语|Malay).{0,16}(或|\/|任选|任一|其中一种|至少一种).{0,16}(英语|英文|English)/i.test(t);
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
  function masterRequired(t){
    for(const clause of clauses(t)){
      const master=/(硕士毕业生|应届硕士|仅限硕士|硕士及以上|研究生及以上|硕士学历|须为硕士|要求硕士)/i.test(clause);
      const bachelorAllowed=/本科及以上|本科或硕士|本科、硕士|本科\/硕士|本科生和硕士|本科以上/i.test(clause);
      if(master&&!bachelorAllowed) return true;
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
    if(masterRequired(t)) reasons.push('学历要求为硕士/研究生，本科不满足');
    if(hardTechRequired(t)) reasons.push('存在必须的技术能力门槛');
    const lang=mandatorySmallLanguage(t);
    if(lang) reasons.push(`必须${lang}，当前英语画像不满足`);
    return {passed:reasons.length===0,reasons:[...new Set(reasons)]};
  }
  function recalcLevel(base,g){
    if(!g.passed) return '不符合硬条件';
    if(base.dataQuality.status==='INVALID') return '数据待修复';
    const p=base.fit.parts,e=base.experienceEvidence;
    if(base.fit.score>=92&&base.dataQuality.score>=8&&p.responsibility>=27&&p.majorLanguage>=16&&p.experience>=21&&e.strongDirect)return'S++';
    if(base.fit.score>=85)return'S';
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
  S.explicitNon2027Title=explicitNon2027Title;
  S.gate=gate;
  S.evaluate=evaluate;
})(typeof globalThis!=='undefined'?globalThis:this);
