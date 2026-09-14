((root,factory)=>{
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root&&root.document) api.start(root);
})(typeof window!=='undefined'?window:null,()=>{
  'use strict';
  const SNAPSHOT_URL='data/snapshot-e316bc7.html';
  const CORE_URL='app-core.js';

  function showLoading(root,text='正在打开精选岗位…'){
    const app=root.document.getElementById('app');
    if(!app)return;
    app.innerHTML=`<div style="max-width:1220px;margin:28px auto;padding:0 24px"><div style="background:#fff;border:1px solid #E2E7EF;border-radius:14px;padding:18px 20px;font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif;color:#33435C"><b style="color:#0B1B33">2027届校招机会看板</b><br>${text}</div></div>`;
  }

  function applySnapshot(html,target){
    const scripts=[...String(html||'').matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
    let applied=0;
    for(const code of scripts){
      if(!/window\.EMBEDDED_(JOBS|META|RISK|COMPANY_META)/.test(code))continue;
      new Function('window',code)(target);
      applied+=1;
    }
    return applied>0&&Array.isArray(target.EMBEDDED_JOBS)&&target.EMBEDDED_JOBS.length>0;
  }

  function riskModuleForUrl(url,risk){
    if(!Array.isArray(risk))return null;
    const text=String(url||'');
    if(text.includes('company-risk-history-priority.js')){
      return `export const priorityCompanyRiskHistory=${JSON.stringify(Array.isArray(risk[1])?risk[1]:[])};`;
    }
    if(text.includes('company-risk-history.js')){
      return `export const companyRiskHistory=${JSON.stringify(Array.isArray(risk[0])?risk[0]:[])};`;
    }
    return null;
  }

  function installEmbeddedRiskFetch(root,risk){
    if(!Array.isArray(risk)||typeof root.fetch!=='function')return()=>{};
    const nativeFetch=root.fetch.bind(root);
    root.fetch=(input,init)=>{
      const url=typeof input==='string'?input:(input&&input.url)||'';
      const moduleText=riskModuleForUrl(url,risk);
      if(moduleText===null)return nativeFetch(input,init);
      return Promise.resolve(new root.Response(moduleText,{status:200,headers:{'content-type':'text/javascript; charset=utf-8','x-board-source':'embedded-risk'}}));
    };
    return()=>{root.fetch=nativeFetch;};
  }

  function replaceAppRoot(root){
    const old=root.document.getElementById('app');
    if(!old)return null;
    const fresh=old.cloneNode(false);
    old.replaceWith(fresh);
    return fresh;
  }

  function loadCore(root,{replaceRoot=false,risk=null,stage='full'}={}){
    if(replaceRoot)replaceAppRoot(root);
    const restoreFetch=installEmbeddedRiskFetch(root,risk);
    return new Promise((resolve,reject)=>{
      const script=root.document.createElement('script');
      script.src=CORE_URL;
      script.async=false;
      script.dataset.boardCoreStage=stage;
      script.onload=()=>{restoreFetch();resolve();};
      script.onerror=()=>{restoreFetch();reject(new Error(`core script failed: ${stage}`));};
      root.document.body.appendChild(script);
    });
  }

  function prepareBootstrap(root){
    const jobs=Array.isArray(root.YINGZHUAN_JOBS)?root.YINGZHUAN_JOBS.filter(Boolean):[];
    if(!jobs.length)return 0;
    root.EMBEDDED_JOBS=jobs.slice();
    root.EMBEDDED_META={
      updatedAt:new Date().toISOString(),
      source:'progressive-bootstrap',
      total:jobs.length,
      bootstrap:true
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
    const snapshotPromise=root.fetch(SNAPSHOT_URL,{cache:'force-cache'})
      .then(res=>{if(!res.ok)throw new Error(`snapshot ${res.status}`);return res.text();});

    const bootstrapCount=prepareBootstrap(root);
    let bootstrapCore=Promise.resolve();
    if(bootstrapCount){
      showLoading(root,`正在打开 ${bootstrapCount} 个英专精选岗位，完整岗位池在后台加载…`);
      bootstrapCore=loadCore(root,{risk:[[],[]],stage:'bootstrap'});
    }else{
      showLoading(root,'正在读取完整岗位快照…');
    }

    try{
      const html=await snapshotPromise;
      await bootstrapCore;
      if(bootstrapCount){
        await waitForBoardReady(root);
        await nextPaint(root);
      }
      if(!applySnapshot(html,root))throw new Error('snapshot payload missing');
      const fullRisk=Array.isArray(root.EMBEDDED_RISK)?root.EMBEDDED_RISK:[[],[]];
      await loadCore(root,{replaceRoot:Boolean(bootstrapCount),risk:fullRisk,stage:'full'});
    }catch(err){
      console.warn('Progressive same-origin snapshot unavailable; keeping fast bootstrap/falling back to remote sources.',err);
      if(bootstrapCount){
        try{await bootstrapCore;}catch(coreErr){console.error(coreErr);}
        return;
      }
      showLoading(root,'同源岗位快照暂不可用，正在切换备用数据源…');
      try{await loadCore(root,{stage:'remote-fallback'});}catch(coreErr){
        console.error(coreErr);
        showLoading(root,'岗位数据暂时不可用，请刷新页面重试。');
      }
    }
  }

  return {start,applySnapshot,riskModuleForUrl,prepareBootstrap};
});
