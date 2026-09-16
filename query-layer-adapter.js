(function(root){
  'use strict';

  const FORBIDDEN_UPSTREAM = [
    'matchScore','match_score','capabilityScore','capability','careerFit','career_fit',
    'decisionScore','decision_score','decisionBucket','decision_bucket','grade','recommendation'
  ];

  function asText(v){
    if(v===null || v===undefined) return '';
    if(Array.isArray(v)) return v.filter(Boolean).map(String).join('、');
    return String(v);
  }

  function assertFactOnly(job){
    const leaked=FORBIDDEN_UPSTREAM.filter(k=>Object.prototype.hasOwnProperty.call(job||{},k));
    if(leaked.length) throw new Error('AI_Job Query Layer 越权包含候选人决策字段: '+leaked.join(', '));
  }

  function adaptQueryJob(job){
    job=job||{};
    assertFactOnly(job);
    const edu=(job.education&&typeof job.education==='object')?job.education:{};
    const major=(job.major&&typeof job.major==='object')?job.major:{};
    const lang=(job.language&&typeof job.language==='object')?job.language:{};
    const years=Array.isArray(job.graduationYear)?job.graduationYear:job.graduationYear?[job.graduationYear]:[];

    const majorClauses=[];
    if(major.raw) majorClauses.push(String(major.raw));
    const eligibilityClauses=years.map(y=>String(y).replace(/届$/,'')+'届');
    if(edu.raw) eligibilityClauses.push(String(edu.raw));
    if(lang.raw) eligibilityClauses.push(String(lang.raw));
    if(lang.minorLanguageRequired && lang.raw && !/必须|必需|要求|熟练|流利|精通|工作语言/.test(String(lang.raw))){
      eligibilityClauses.push('必须具备'+String(lang.raw));
    }

    const desc=[
      edu.raw?'学历要求：'+edu.raw:'',
      major.raw?'专业要求：'+major.raw:'',
      lang.raw?'语言要求：'+lang.raw:'',
      job.JD||''
    ].filter(Boolean).join('\n');

    return {
      id: job.id||'',
      company: job.company||'',
      title: job.title||'',
      graduationYear: years,
      education: edu.raw||edu.min||'',
      major: major.raw||'',
      languages: lang.raw?[String(lang.raw)]:[],
      city: asText(job.location),
      description: desc,
      jobDescription: job.JD||'',
      jobRequirements: [edu.raw, major.raw, lang.raw].filter(Boolean).join('；'),
      jdEvidence: {
        majorClauses,
        eligibilityClauses,
        businessDuties: [],
        technicalDuties: []
      },
      sourceType: job.sourceType||'',
      source: job.source||'',
      sourceUrl: job.officialURL||'',
      deadline: job.deadline||'',
      publishedAt: job.lastVerified||'',
      queryEligibility: {
        masterRequired: !!edu.masterRequired,
        majorHardRestriction: !!major.hardRestriction,
        english: !!lang.english,
        minorLanguageRequired: !!lang.minorLanguageRequired
      }
    };
  }

  function adaptQueryPayload(payload){
    if(!payload || payload.schemaVersion!==1 || !Array.isArray(payload.jobs)) throw new Error('不支持的 AI_Job Query Layer schema');
    if(Number(payload.totalJobs)!==payload.jobs.length) throw new Error('AI_Job Query Layer 岗位总数不一致');
    return payload.jobs.map(adaptQueryJob);
  }

  root.AIJobQueryAdapter={adaptQueryJob,adaptQueryPayload,assertFactOnly};
  if(typeof module!=='undefined' && module.exports) module.exports=root.AIJobQueryAdapter;
})(typeof globalThis!=='undefined'?globalThis:this);
