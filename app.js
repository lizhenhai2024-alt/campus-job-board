((root,factory)=>{
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root&&root.document) api.start(root);
})(typeof window!=='undefined'?window:null,()=>{
  'use strict';
  const TOP_JOBS_URL='/api/jobs?limit=100';
  const APP_CORE_URL='/app-core.js';
  const LOGIC_PATCH_URL='/logic-correctness.js';
  const MAX_JOBS=100;
  const TOP_JOBS_TIMEOUT_MS=2500;

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
    // 正常生产路径以 Campus 评分后的实时候选为准；精选池只用于不足数量或故障兜底，不能挤掉更优实时岗位。
    for(const job of [...(Array.isArray(jobs)?jobs:[]),...(Array.isArray(curated)?curated:[])]){
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

  function loadScript(root,src,datasetKey){
    return new Promise((resolve,reject)=>{
      if(datasetKey&&root.document.querySelector(`script[data-${datasetKey}]`)){resolve();return;}
      const script=root.document.createElement('script');
      script.src=src;
      script.async=false;
      if(datasetKey)script.dataset[datasetKey.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]='1';
      script.onload=resolve;
      script.onerror=()=>reject(new Error(`script failed: ${src}`));
      root.document.body.appendChild(script);
    });
  }

  function loadLogicPatch(root){
    if(root.BoardLogicCorrectness){
      if(root.CampusScoring)root.BoardLogicCorrectness.patchScoring(root.CampusScoring);
      return Promise.resolve();
    }
    return loadScript(root,LOGIC_PATCH_URL,'board-logic-correctness');
  }

  function loadCore(root,{stage='full'}={}){
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

  function fetchTopJobs(root,nativeFetch,timeoutMs=TOP_JOBS_TIMEOUT_MS){
    const controller=typeof root.AbortController==='function'?new root.AbortController():null;
    let timer=null;
    if(controller&&timeoutMs>0){
      timer=root.setTimeout(()=>controller.abort(),timeoutMs);
    }
    return nativeFetch(TOP_JOBS_URL,{cache:'force-cache',signal:controller?controller.signal:undefined})
      .then(async res=>{
        if(!res.ok)throw new Error(`top100 ${res.status}`);
        const payload=await res.json();
        if(!Array.isArray(payload.jobs)||!payload.jobs.length)throw new Error('top100 payload missing');
        return payload;
      })
      .finally(()=>{if(timer!==null)root.clearTimeout(timer);});
  }

  async function start(root){
    root.BOARD_TOP100_ONLY=true;
    const nativeFetch=root.fetch.bind(root);
    try{
      await loadLogicPatch(root);
    }catch(err){
      console.error('Logic correctness layer failed to load.',err);
      showLoading(root,'评价规则加载失败，请刷新页面重试。');
      return;
    }

    const bootstrapCount=prepareBootstrap(root);
    showLoading(root,bootstrapCount
      ?`正在从完整候选池计算最匹配岗位；网络较慢时将直接打开 ${bootstrapCount} 个精选岗位…`
      :`正在计算前 ${MAX_JOBS} 个最匹配岗位…`);

    const topJobsPromise=fetchTopJobs(root,nativeFetch);
    installTop100FetchGuard(root,topJobsPromise,nativeFetch);

    try{
      const payload=await topJobsPromise;
      // /api/jobs 已经基于完整 AI_Job 候选池执行 Campus Eligibility + Fit 排序；不要再让本地精选池占用 Top-100 配额。
      const jobs=composeTopJobs(payload.jobs,[],MAX_JOBS);
      root.EMBEDDED_JOBS=jobs;
      root.EMBEDDED_META=Object.assign({},payload.meta||{},{source:'ranked-top100-api',total:jobs.length,limit:MAX_JOBS,top100Only:true});
      root.EMBEDDED_RISK=[[],[]];
      root.EMBEDDED_COMPANY_META={};
      // app-core 会自动 mergeYingzhuan；正常实时路径必须关闭该合并，否则精选岗位会再次绕过评分排序。
      root.YINGZHUAN_JOBS=[];
      await loadCore(root,{stage:'top100'});
    }catch(err){
      console.warn('Ranked Top-100 jobs unavailable or slow; using curated bootstrap.',err);
      if(bootstrapCount){
        await loadCore(root,{stage:'bootstrap'});
        return;
      }
      showLoading(root,'前100岗位暂时不可用，请刷新页面重试。');
    }
  }

  return {start,composeTopJobs,isLiveJobsUrl,moduleTextForTopJobs,prepareBootstrap,fetchTopJobs,loadLogicPatch};
});