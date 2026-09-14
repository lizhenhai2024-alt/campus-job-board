(()=>{'use strict';
const SNAPSHOT_URL='/data/snapshot-e316bc7.html';
const APP_CORE_URL='/app-core.js';
const app=document.getElementById('app');

function showLoading(){
  if(!app) return;
  app.innerHTML='<main class="wrap"><section class="hero"><div class="hero-in" style="padding-bottom:28px"><div class="hero-left"><h1>2027届校招机会看板 · 英语专业</h1><div class="hero-profile">正在加载本地岗位快照…</div></div></div></section></main>';
}

function runTrustedSnapshotScript(code){
  const script=document.createElement('script');
  script.textContent=code;
  document.head.appendChild(script);
  script.remove();
}

function applySnapshot(html){
  const re=/<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let applied=0;
  while((match=re.exec(html))!==null){
    const code=match[1]||'';
    if(/window\.EMBEDDED_(?:JOBS|META|RISK|COMPANY_META)\s*=/.test(code)){
      runTrustedSnapshotScript(code);
      applied+=1;
    }
  }
  return applied>0 && Array.isArray(window.EMBEDDED_JOBS) && window.EMBEDDED_JOBS.length>0;
}

function loadCore(){
  const script=document.createElement('script');
  script.src=APP_CORE_URL;
  script.async=false;
  script.onerror=()=>{
    if(app) app.innerHTML='<main class="wrap"><div class="empty"><b>页面程序加载失败</b><div>请刷新页面重试。</div></div></main>';
  };
  document.body.appendChild(script);
}

async function bootstrap(){
  showLoading();
  try{
    const response=await fetch(SNAPSHOT_URL,{cache:'force-cache'});
    if(!response.ok) throw new Error(`snapshot ${response.status}`);
    const html=await response.text();
    if(!applySnapshot(html)) throw new Error('snapshot payload missing');
  }catch(error){
    console.warn('[snapshot bootstrap]',error);
  }finally{
    loadCore();
  }
}

bootstrap();
})();