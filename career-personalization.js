(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.CareerPersonalization=api;
  if(typeof document!=='undefined') api.initBrowser();
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const VERSION='1.2';
  const MIN_COMPLETION=60;
  const LEVEL_RANK={'S++':7,'S':6,'A':5,'B':4,'C':3,'D':2,'不符合硬条件':1,'数据待修复':0};

  const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,Number(v)||0));
  const weightedAverage=(pairs)=>{
    const valid=pairs.filter(([v,w])=>Number.isFinite(v)&&w>0);
    if(!valid.length)return null;
    const den=valid.reduce((s,[,w])=>s+w,0);
    return Math.round(valid.reduce((s,[v,w])=>s+v*w,0)/den);
  };
  function directionKey(direction,cf){
    if(!cf?.DIRECTIONS)return null;
    return Object.keys(cf.DIRECTIONS).find(k=>cf.DIRECTIONS[k].board===direction||cf.DIRECTIONS[k].name===direction)||null;
  }
  function workstyleScore(state,key,cf){
    if(!cf?.WORK)return null;
    const vals=[];
    cf.WORK.forEach((q,i)=>{
      if(!q[2].includes(key))return;
      const raw=state?.work?.[i];
      if(raw==null)return;
      const v=Number(raw);
      vals.push(v===0?100:v===1?60:20);
    });
    return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null;
  }
  function careerScore(state,key,cf){
    const p=cf.profile(state),I=p.interestScores[key]?.score,E=p.evidenceScores[key]?.score,W=workstyleScore(state,key,cf);
    return {completion:p.completion,interest:I,evidence:E,workstyle:W,score:weightedAverage([[I,.55],[W,.30],[E,.15]])};
  }
  function answerRiskFactor(state,index){
    const raw=state?.work?.[index];
    return raw==null?1:clamp(Number(raw)/2,0,1);
  }
  function kpiRiskFactor(state){
    const vals=[state?.work?.[3],state?.work?.[6]].filter(v=>v!=null).map(Number);
    if(!vals.length)return 1;
    return clamp(vals.reduce((a,b)=>a+b,0)/(vals.length*2),0,1);
  }
  function adjustedRisk(baseRisk,state){
    const source=baseRisk||{deduction:0,items:[]};
    const items=[];
    for(const item of source.items||[]){
      const label=String(item.label||'');
      const original=Number(item.value||0);
      let factor=1;
      if(/长期派驻|驻外|长期海外|海外工作地点/.test(label)) factor=answerRiskFactor(state,0);
      else if(/高频出差/.test(label)) factor=answerRiskFactor(state,4);
      else if(/强销售KPI/.test(label)) factor=kpiRiskFactor(state);
      const value=Math.round(original*factor);
      if(value>0) items.push({...item,value,originalValue:original,personalized:factor!==1});
    }
    return {deduction:Math.min(35,items.reduce((s,x)=>s+Number(x.value||0),0)),items};
  }
  function fitLevel(result,job,personalFit,capabilityScore,scoring){
    if(!result.gate?.passed)return'不符合硬条件';
    if(result.dataQuality?.status==='INVALID')return'数据待修复';
    const p=result.fit?.parts||{},e=result.experienceEvidence||{};
    let level;
    if(personalFit>=92&&(result.dataQuality?.score||0)>=8&&(p.responsibility||0)>=27&&(p.majorLanguage||0)>=16&&(p.experience||0)>=21&&e.strongDirect) level='S++';
    else if(personalFit>=85&&(result.dataQuality?.score||0)>=7&&(p.responsibility||0)>=25&&(p.majorLanguage||0)>=16&&(p.experience||0)>=18&&e.strongDirect) level='S';
    else if(personalFit>=75){
      if(result.direction==='PMO·项目管理'&&scoring?.pmoHasEnglishSignal&&!scoring.pmoHasEnglishSignal(job)) level='B';
      else level='A';
    }else if(personalFit>=65) level='B';
    else if(personalFit>=50) level='C';
    else level='D';
    if(capabilityScore<60&&(LEVEL_RANK[level]||0)>LEVEL_RANK.B) level='B';
    return level;
  }
  function recommendationLevel(result,fitLvl,priority,capabilityScore){
    if(!result.gate?.passed)return'不符合硬条件';
    if(result.dataQuality?.status==='INVALID')return'数据待修复';
    let level=priority>=92?'S++':priority>=85?'S':priority>=75?'A':priority>=65?'B':priority>=50?'C':'D';
    if((LEVEL_RANK[level]||0)>(LEVEL_RANK[fitLvl]||0))level=fitLvl;
    if(capabilityScore<60&&(LEVEL_RANK[level]||0)>LEVEL_RANK.B)level='B';
    if(result.dataQuality?.status==='PARTIAL'&&(LEVEL_RANK[level]||0)>LEVEL_RANK.B)level='B';
    return level;
  }
  function personalizeEvaluation(base,job,state,cf,scoring){
    if(!base||!cf?.profile)return base;
    const key=directionKey(base.direction,cf);
    if(!key)return base;
    const c=careerScore(state,key,cf);
    if(c.completion<MIN_COMPLETION||c.interest==null||c.score==null){
      base.personalization={active:false,version:VERSION,completion:c.completion||0,reason:'Career Fit 信息不足'};
      return base;
    }

    const oldParts=base.fit?.parts||{};
    const oldCareer=Number(oldParts.careerValue||0);
    const baseFit=Number(base.fit?.score||0);
    const nonCareer=clamp(baseFit-oldCareer,0,85);
    const capabilityScore=Math.round(nonCareer/85*100);
    const newCareer=Math.round(clamp(c.score)*15/100);
    const personalFit=clamp(nonCareer+newCareer);
    const risk=adjustedRisk(base.risk,state);
    const priority=clamp(personalFit-risk.deduction);

    const original={fitScore:baseFit,priorityScore:Number(base.priorityScore||0),level:base.level,fitLevel:base.fitLevel||base.level,careerValue:oldCareer,riskDeduction:Number(base.risk?.deduction||0)};
    base.fit={...base.fit,score:personalFit,parts:{...oldParts,careerValue:newCareer}};
    base.risk=risk;
    base.priorityScore=priority;
    base.fitLevel=fitLevel(base,job,personalFit,capabilityScore,scoring);
    base.recommendationLevel=recommendationLevel(base,base.fitLevel,priority,capabilityScore);
    base.level=base.recommendationLevel;
    base.personalization={active:true,version:VERSION,key,completion:c.completion,capabilityScore,careerScore:c.score,interest:c.interest,evidence:c.evidence,workstyle:c.workstyle,original,careerValue:newCareer};
    base.reasoning=base.reasoning||{};
    base.reasoning.career=`Career Fit V${VERSION}：兴趣 ${c.interest??'—'} / 工作方式 ${c.workstyle??'—'} / 行为证据 ${c.evidence??'—'}，职业方向价值 ${newCareer}/15（原静态值 ${oldCareer}/15）。`;
    base.reasoning.risk=risk.items.length?risk.items.map(x=>`${x.label} -${x.value}${x.personalized?`（个体化，原-${x.originalValue}）`:''}`).join('；'):'Career Fit 工作方式与已识别个人摩擦项暂无明显冲突。';
    base.reasoning.recommendation=`能力准备度 ${capabilityScore}/100；个性化适配 ${personalFit}/100；风险调整后优先分 ${priority}；最终推荐 ${base.recommendationLevel}${base.dataQuality?.status==='PARTIAL'?'（待核，上限B）':''}。`;
    return base;
  }
  function loadState(cf){
    if(typeof localStorage==='undefined')return cf?.blankState?cf.blankState():{interest:{},evidence:{},work:{}};
    try{return cf.normalizeState(JSON.parse(localStorage.getItem(cf.STORAGE)||'{}'));}catch{return cf.blankState();}
  }
  function rerenderBoard(){
    if(typeof document==='undefined')return;
    const active=document.querySelector('#app [data-tab].active')||document.querySelector('#app [data-tab="jobs"]');
    if(active)setTimeout(()=>active.click(),0);
  }
  function decorateText(){
    if(typeof document==='undefined')return;
    const hero=document.querySelector('#career-fit-root .cf-hero p');
    if(hero&&!hero.dataset.v12){hero.dataset.v12='1';hero.textContent='分三部分：你想做什么（兴趣）、你做过什么（证据）、你能接受什么（工作方式）。完成度达到 60% 后，职业方向 15 分与驻外/出差/销售 KPI 的个人摩擦会参与个性化 S/A/B；硬门槛、职责、专业语言、真实经历和公司外部风险不会被兴趣覆盖。';}
    const disc=document.querySelector('#career-fit-root .cf-disclaimer');
    if(disc&&!disc.dataset.v12){disc.dataset.v12='1';disc.textContent='Career Fit V1.2 只影响个人化的职业方向价值与工作方式摩擦。Eligibility Gate、JD职责、专业语言、真实经历、Data Quality 与公司外部风险仍按机会看板原规则独立判断。';}
    const summary=document.querySelector('#app .cf-board-summary b');
    if(summary){const cf=root.CareerFit2027,p=cf?.profile?cf.profile(loadState(cf)):null;if(p?.completion>=MIN_COMPLETION)summary.textContent='Career Fit · 已参与个性化推荐';}
    const notes=document.querySelector('#app .notes-grid');
    if(notes&&!notes.querySelector('.cf-personal-note')){
      const div=document.createElement('div');div.className='note-item full cf-personal-note';div.innerHTML='<b>Career Fit V1.2</b>：完成度达到 60% 后，原“职业方向价值 15 分”改由兴趣 × 工作方式 × 行为证据动态计算；驻外/高频出差/销售 KPI 只按个人可接受程度保留相应摩擦扣分。硬 Gate、职责、专业语言、真实经历与数据质量不被兴趣覆盖。';notes.appendChild(div);
    }
  }
  function patchScoring(){
    const scoring=root.CampusScoring,cf=root.CareerFit2027;
    if(!scoring?.evaluate||!cf?.profile)return false;
    if(scoring.__careerPersonalizedV12)return true;
    const oldEvaluate=scoring.evaluate.bind(scoring);
    scoring.evaluate=function(job,now){return personalizeEvaluation(oldEvaluate(job,now),job,loadState(cf),cf,scoring);};
    scoring.__careerPersonalizedV12=true;
    scoring.careerPersonalizationVersion=VERSION;
    rerenderBoard();
    return true;
  }
  function initBrowser(){
    let tries=0;
    const timer=setInterval(()=>{tries++;if(patchScoring()||tries>250)clearInterval(timer);},20);
    document.addEventListener('change',ev=>{if(ev.target?.matches?.('[data-cf-kind]'))setTimeout(()=>{patchScoring();rerenderBoard();decorateText();},0);});
    window.addEventListener('storage',ev=>{if(ev.key===root.CareerFit2027?.STORAGE){rerenderBoard();decorateText();}});
    const observer=new MutationObserver(()=>decorateText());observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(decorateText,0);
  }

  return {VERSION,MIN_COMPLETION,directionKey,workstyleScore,careerScore,adjustedRisk,fitLevel,recommendationLevel,personalizeEvaluation,initBrowser};
});
