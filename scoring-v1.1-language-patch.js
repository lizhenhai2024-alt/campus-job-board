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
  function alternativesSatisfied(t){
    return /(英语|英文|English).{0,16}(或|\/|任选|任一|其中一种|至少一种).{0,16}(日语|日文|Japanese|西班牙语|西语|Spanish|德语|German|法语|French|韩语|Korean|葡萄牙语|葡语|Portuguese|俄语|Russian|意大利语|Italian|阿拉伯语|Arabic|泰语|Thai|越南语|Vietnamese|印尼语|Indonesian|马来语|Malay)/i.test(t)
      || /(日语|日文|Japanese|西班牙语|西语|Spanish|德语|German|法语|French|韩语|Korean|葡萄牙语|葡语|Portuguese|俄语|Russian|意大利语|Italian|阿拉伯语|Arabic|泰语|Thai|越南语|Vietnamese|印尼语|Indonesian|马来语|Malay).{0,16}(或|\/|任选|任一|其中一种|至少一种).{0,16}(英语|英文|English)/i.test(t);
  }
  function mandatorySmallLanguage(t){
    t=String(t||'');
    if(alternativesSatisfied(t)) return null;
    const clauses=t.split(/[。；;，,\n]/).map(x=>x.trim()).filter(Boolean);
    for(const clause of clauses){
      for(const [name,langRx,certRx] of LANGS){
        if(!langRx.test(clause)) continue;
        const preferred=/(优先|加分|更佳|preferred|plus)/i.test(clause);
        const explicit=/(必须|要求|需具备|须具备|应具备|可作为工作语言|工作语言|熟练|精通)/i.test(clause);
        const cert=certRx&&certRx.test(clause);
        if((explicit||cert) && !preferred) return name;
      }
    }
    return null;
  }
  function gate(job,now=new Date()){
    const old=oldGate(job,now);
    const reasons=old.reasons.filter(x=>!/^必须.+当前英语画像不满足$/.test(x));
    const lang=mandatorySmallLanguage(sourceText(job));
    if(lang) reasons.push(`必须${lang}，当前英语画像不满足`);
    return {passed:reasons.length===0,reasons};
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
  S.gate=gate;
  S.evaluate=evaluate;
})(typeof globalThis!=='undefined'?globalThis:this);
