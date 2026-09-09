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
