// Vercel Serverless Function — GET /api/jobs
// Returns only the first 100 jobs from AI_Job. It intentionally uses HTTP Range
// so the server does not need to download the complete multi-megabyte job pool.

const SOURCE='https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/live-jobs.js';
const DEFAULT_LIMIT=100;
const MAX_LIMIT=100;
const RANGE_ENDS=[1024*1024-1,2*1024*1024-1,4*1024*1024-1];

function clampLimit(value){
  const n=Number.parseInt(value,10);
  if(!Number.isFinite(n)||n<=0)return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT,n);
}

function parseTopJobs(source,limit=DEFAULT_LIMIT){
  const text=String(source||'');
  const marker='export const liveJobs';
  const markerAt=text.indexOf(marker);
  if(markerAt<0)return[];
  const arrayAt=text.indexOf('[',markerAt+marker.length);
  if(arrayAt<0)return[];
  const jobs=[];
  let i=arrayAt+1;
  while(i<text.length&&jobs.length<limit){
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

async function fetchTopJobs(limit){
  let lastError=null;
  for(const end of RANGE_ENDS){
    try{
      const response=await fetch(SOURCE,{headers:{Range:`bytes=0-${end}`,'User-Agent':'campus-job-board-top100'}});
      if(!response.ok&&response.status!==206)throw new Error(`upstream ${response.status}`);
      const text=await response.text();
      const jobs=parseTopJobs(text,limit);
      if(jobs.length>=limit||response.status===200){
        if(!jobs.length)throw new Error('no jobs parsed');
        return{jobs:jobs.slice(0,limit),rangeBytes:text.length,upstreamStatus:response.status};
      }
    }catch(err){lastError=err;}
  }
  throw lastError||new Error('unable to parse top jobs');
}

async function handler(req,res){
  if(req.method!=='GET'){
    res.status(405).json({error:'method not allowed'});
    return;
  }
  const limit=clampLimit(req.query&&req.query.limit);
  try{
    const result=await fetchTopJobs(limit);
    res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=3600');
    res.status(200).json({
      jobs:result.jobs,
      meta:{
        source:'AI_Job first jobs',
        limit,
        count:result.jobs.length,
        upstreamStatus:result.upstreamStatus,
        rangeBytes:result.rangeBytes,
        generatedAt:new Date().toISOString()
      }
    });
  }catch(err){
    res.setHeader('Cache-Control','no-store');
    res.status(502).json({error:String(err&&err.message||err)});
  }
}

module.exports=handler;
module.exports.parseTopJobs=parseTopJobs;
module.exports.clampLimit=clampLimit;
