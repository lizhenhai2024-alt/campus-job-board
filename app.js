((root,factory)=>{
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root&&root.document) api.start(root);
})(typeof window!=='undefined'?window:null,()=>{
  'use strict';
  const TOP_JOBS_URL='/api/jobs?limit=100';
  const APP_CORE_URL='/app-core.js';
  const MAX_JOBS=100;

  function showLoading(root,text='正在打开精选岗位…'){
    const app=root.document.getElementById('app');
    if(!app)return;
    app.innerHTML=`<div style="max-width:1220px;margin:28px auto;padding:0 24px"><div style="background:#fff;border:1px solid #E2E7EF;border-radius:14px;padding:18px 20px;font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;color:#33435C"><b style="color:#0B1B33">2027届校招机会看板</b><br>${text}</div></div>`;
  }

  function jobKey(job){
    return `${String(job&&job.company||'').trim().toLowerCase()}|${String(job&&job.title||'').replace(/\s+/g,'').toLowerCase()}`;
  }

  function composeTopJobs(jobs,curated=[],limit=MAX_JOBS){
    const out=[],seen=new Set();
    for(const job of [...(Array.isArray(curated)?curated:[]),...(Array.isArray(jobs)?jobs:[])]){
      if(!job)continue;
      const key=jobKey(job)||String(job.id||'');
      if(key&&seen.has(key))continue;
      if(key)seen.add(key);
      out.push(job);
      if(out.length>=limit)break;
    }
    return out;
  }

  function isLiveJobsUrl(url){
    const text=String(url||'');
    return text.includes('/AI_Job/')&&text.includes('/src/data/live-jobs.js')||text.includes('cdn.jsdelivr.net/gh/lizhenhai2024-alt/AI_Job')&&text.includes('/src/data/live-jobs.js');
  }

  function moduleTextForTopJobs(payload,curated=[]){
    const jobs=composeTopJobs(payload&&payload.jobs,curated,MAX_JOBS);
    const meta=Object.assign({},payload&&payload.meta||{},{limit:MAX_JOBS,count:jobs.length,top100Only:true});
    return `export const liveJobs=${JSON.stringify(jobs)};\nexport const meta=${JSON.stringify(meta)};`;
  }

  function installTop100FetchGuard(root,topJobsPromise,nativeFetch){
    if(typeof root.fetch!=='function')return()=>{};
    const baseFetch=nativeFetch||root.fetch.bind(root);
    root.fetch=(input,init)=>{
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(!isLiveJobsUrl(url))return baseFetch(input,init);
      return topJobsPromise.then(payload=>new root.Response(moduleTextForTopJobs(payload,root.YINGZHUAN_JOBS),{
        status:200,
        headers:{'content-type':'text/javascript; charset=utf-8','x-board-source':'top100-guard'}
      }));
    };
    return()=>{root.fetch=baseFetch;};
  }

  function replaceAppRoot(root){
    const old=root.document.getElementById('app');
    if(!old)return null;
    const fresh=old.cloneNode(false);
    old.replaceWith(fresh);
    return fresh;
  }

  function loadCore(root,{replaceRoot=false,stage='full'}={}){
    if(replaceRoot)replaceAppRoot(root);
    return new Promise((resolve,reject)=>{
      const script=root.document.createElement('script');
      script.src=APP_CORE_URL;
      script.async=false;
      script.dataset.boardCoreStage=stage;
      script.onload=resolve;
      script.onerror=()=>reject(new Error(`core script failed: ${stage}`));
      root.document.body.appendChild(script);
    });
  }

  function prepareBootstrap(root){
    const jobs=composeTopJobs([],root.YINGZHUAN_JOBS,MAX_JOBS);
    if(!jobs.length)return 0;
    root.EMBEDDED_JOBS=jobs;
    root.EMBEDDED_META={
      updatedAt:new Date().toISOString(),
      source:'curated-bootstrap',
      total:jobs.length,
      limit:MAX_JOBS,
      bootstrap:true,
      top100Only:true
    };
    root.EMBEDDED_RISK=[[],[]];
    const meta=root.YINGZHUAN_META&&typeof root.YINGZHUAN_META==='object'?root.YINGZHUAN_META:{};
    root.EMBEDDED_COMPANY_META=Object.keys(meta).length?Object.assign({},meta):{__bootstrap:{}};
    return jobs.length;
  }

  function waitForBoardReady(root,timeout=1800){
    const start=Date.now();
    return new Promise(resolve=>{
      const poll=()=>{
        const ready=root.document.querySelector('.hero,.company-grid,.list,.summary,.topbar');
        if(ready||Date.now()-start>=timeout)return resolve(Boolean(ready));
        root.setTimeout(poll,25);
      };
      poll();
    });
  }

  function nextPaint(root){
    if(typeof root.requestAnimationFrame!=='function')return Promise.resolve();
    return new Promise(resolve=>root.requestAnimationFrame(()=>root.requestAnimationFrame(resolve)));
  }

  async function start(root){
    root.BOARD_TOP100_ONLY=true;
    const nativeFetch=root.fetch.bind(root);
    const topJobsPromise=nativeFetch(TOP_JOBS_URL,{cache:'no-store'})
      .then(async res=>{
        if(!res.ok)throw new Error(`top100 ${res.status}`);
        const payload=await res.json();
        if(!Array.isArray(payload.jobs)||!payload.jobs.length)throw new Error('top100 payload missing');
        return payload;
      });
    installTop100FetchGuard(root,topJobsPromise,nativeFetch);

    const bootstrapCount=prepareBootstrap(root);
    let bootstrapCore=Promise.resolve();
    if(bootstrapCount){
      showLoading(root,`正在打开 ${bootstrapCount} 个精选岗位，最多加载前 ${MAX_JOBS} 个岗位…`);
      bootstrapCore=loadCore(root,{stage:'bootstrap'});
    }else{
      showLoading(root,`正在读取前 ${MAX_JOBS} 个岗位…`);
    }

    try{
      const payload=await topJobsPromise;
      await bootstrapCore;
      if(bootstrapCount){
        await waitForBoardReady(root);
        await nextPaint(root);
      }
      const jobs=composeTopJobs(payload.jobs,root.YINGZHUAN_JOBS,MAX_JOBS);
      root.EMBEDDED_JOBS=jobs;
      root.EMBEDDED_META=Object.assign({},payload.meta||{},{source:'top100-api',total:jobs.length,limit:MAX_JOBS,top100Only:true});
      root.EMBEDDED_RISK=[[],[]];
      root.EMBEDDED_COMPANY_META={};
      await loadCore(root,{replaceRoot:Boolean(bootstrapCount),stage:'top100'});
    }catch(err){
      console.warn('Top-100 jobs unavailable; keeping curated bootstrap only.',err);
      if(bootstrapCount){
        try{await bootstrapCore;}catch(coreErr){console.error(coreErr);}
        return;
      }
      showLoading(root,'前100岗位暂时不可用，请刷新页面重试。');
    }
  }

  return {start,composeTopJobs,isLiveJobsUrl,moduleTextForTopJobs,prepareBootstrap};
});
