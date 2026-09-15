// Vercel Serverless Function — GET /api/jobs
// Scans the complete AI_Job live pool, applies campus-job-board Eligibility/Fit logic,
// then returns only the highest-ranked 100 jobs to keep the browser fast.

const Scoring=require('../scoring.js');
const Logic=require('../logic-correctness.js');
Logic.patchScoring(Scoring);

const SOURCE='https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/live-jobs.js';
const DEFAULT_LIMIT=100;
const MAX_LIMIT=100;

function clampLimit(value){
  const n=Number.parseInt(value,10);
  if(!Number.isFinite(n)||n<=0)return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT,n);
}

function parseJobs(source,limit=Number.POSITIVE_INFINITY){
  const text=String(source||'');
  const marker='export const liveJobs';
  const markerAt=text.indexOf(marker);
  if(markerAt<0)return[];
  const arrayAt=text.indexOf('[',markerAt+marker.length);
  if(arrayAt<0)return[];
  const max=Number.isFinite(limit)&&limit>0?limit:Number.POSITIVE_INFINITY;
  const jobs=[];
  let i=arrayAt+1;
  while(i<text.length&&jobs.length<max){
    while(i<text.length&&(/[\s,]/.test(text[i])))i+=1;
    if(i>=text.length||text[i]===']')break;
    if(text[i]!=='{'){i+=1;continue;}
    const start=i;
    let depth=0,inString=false,escaped=false,complete=false;
    for(;i<text.length;i+=1){
      const ch=text[i];
      if(inString){
        if(escaped){escaped=false;continue;}
        if(ch==='\\'){escaped=true;continue;}
        if(ch==='"')inString=false;
        continue;
      }
      if(ch==='"'){inString=true;continue;}
      if(ch==='{')depth+=1;
      else if(ch==='}'){
        depth-=1;
        if(depth===0){
          const raw=text.slice(start,i+1);
          try{jobs.push(JSON.parse(raw));}catch(err){throw new Error(`invalid job JSON near item ${jobs.length+1}: ${err.message}`);}
          i+=1;
          complete=true;
          break;
        }
      }
    }
    if(!complete)break;
  }
  return jobs;
}

function selectTopJobs(jobs,limit=DEFAULT_LIMIT,now=new Date(),scoring=Scoring){
  const evaluated=[];
  for(const job of Array.isArray(jobs)?jobs:[]){
    if(!job)continue;
    const result=scoring.evaluate(job,now);
    if(!result?.gate?.passed)continue;
    if(result?.dataQuality?.status==='INVALID')continue;
    evaluated.push({...job,_evaluation:result});
  }
  evaluated.sort(scoring.compare);
  return {
    jobs:evaluated.slice(0,limit).map(row=>{
      const {_evaluation,...job}=row;
      return job;
    }),
    eligibleCount:evaluated.length
  };
}

async function fetchFullPool(){
  const response=await fetch(SOURCE,{
    headers:{'User-Agent':'campus-job-board-ranked-top100'},
    cache:'no-store'
  });
  if(!response.ok)throw new Error(`upstream ${response.status}`);
  const text=await response.text();
  const jobs=parseJobs(text);
  if(!jobs.length)throw new Error('no jobs parsed from upstream');
  return {jobs,bytes:text.length,upstreamStatus:response.status};
}

async function handler(req,res){
  if(req.method!=='GET'){
    res.status(405).json({error:'method not allowed'});
    return;
  }
  const limit=clampLimit(req.query&&req.query.limit);
  try{
    const source=await fetchFullPool();
    const ranked=selectTopJobs(source.jobs,limit,new Date());
    if(!ranked.jobs.length)throw new Error('no eligible ranked jobs');
    res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=1800');
    res.status(200).json({
      jobs:ranked.jobs,
      meta:{
        source:'AI_Job full pool → campus-job-board scoring',
        limit,
        count:ranked.jobs.length,
        scannedCount:source.jobs.length,
        eligibleCount:ranked.eligibleCount,
        upstreamStatus:source.upstreamStatus,
        sourceBytes:source.bytes,
        generatedAt:new Date().toISOString()
      }
    });
  }catch(err){
    res.setHeader('Cache-Control','no-store');
    res.status(502).json({error:String(err&&err.message||err)});
  }
}

module.exports=handler;
module.exports.parseJobs=parseJobs;
module.exports.selectTopJobs=selectTopJobs;
module.exports.clampLimit=clampLimit;