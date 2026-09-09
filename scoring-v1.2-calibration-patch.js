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
