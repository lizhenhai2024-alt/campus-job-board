(()=>{'use strict';
const E=window.CampusScoring;
if(!E) throw new Error('CampusScoring not loaded');

/* ---- 数据源：运行时优先拉取最新，失败回退到内置快照 ---- */
const DATA_URLS=['https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/live-jobs.js','https://cdn.jsdelivr.net/gh/lizhenhai2024-alt/AI_Job@main/src/data/live-jobs.js'];
const RISK_SOURCES=[
  {exportName:'companyRiskHistory',urls:['https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/company-risk-history.js','https://cdn.jsdelivr.net/gh/lizhenhai2024-alt/AI_Job@main/src/data/company-risk-history.js'],fallback:0},
  {exportName:'priorityCompanyRiskHistory',urls:['https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/company-risk-history-priority.js','https://cdn.jsdelivr.net/gh/lizhenhai2024-alt/AI_Job@main/src/data/company-risk-history-priority.js'],fallback:1}
];
const EMBEDDED_JOBS=window.EMBEDDED_JOBS||[];
const EMBEDDED_META=window.EMBEDDED_META||{};
const EMBEDDED_RISK=window.EMBEDDED_RISK||[[],[]];


const RISK_SOURCE_GUIDE=[
  {level:'A',name:'一手材料',sources:'公司公告/官网、交易所/监管、法院/裁判文书、公司官方公众号/微博',usage:'可直接确认事件主体、时间与事实边界。'},
  {level:'B',name:'高可信媒体 / 公司回应',sources:'Reuters、第一财经、界面、澎湃等，或媒体明确引用公司回应',usage:'用于确认公开事件；不把报道范围扩大到未提及的团队、地区或年份。'},
  {level:'C',name:'社区经验线索',sources:'CampusShame、牛客、脉脉、知乎、V2EX 等',usage:'用于发现校招毁约、实习留用、工作强度等线索；保留原帖/快照，不能由单帖外推成全公司事实。'},
  {level:'D',name:'未经核实传闻',sources:'无法追溯原帖、仅截图转述或单一匿名爆料',usage:'默认隐藏，不作为事实、黑名单或投递结论。'}
];
const STORAGE='campus-job-board:redesign:v1';
const SYNC_SECRET_KEY='campus-job-board:sync-secret';
const STAGES=['已收藏','已投递','笔试','面试','Offer','淘汰'];
const LEVELS=['全部','S','A','B','C','D','数据待修复'];
const QUICK_LEVELS=['全部','S','A','B'];
const NORMAL_LEVELS=new Set(['S++','S','A','B','C','D']);
const DISPLAY_LEVEL=l=>l==='S++'?'S':l;
const fb=[{id:'fallback-1',company:'示例公司',title:'海外业务运营（2027届）',city:'深圳',graduationYear:'2027',roleFamily:['海外运营'],languages:['英语'],experienceKeywords:['海外业务','市场研究','客户信息'],preferenceTags:['国际业务','出海'],source:'回退示例',sourceType:'secondary',sourceUrl:'https://example.com/job',deadline:'2026-12-31',description:'实时岗位池不可用时的示例岗位，英语用于海外业务沟通。'}];

let persisted={};try{persisted=JSON.parse(localStorage.getItem(STORAGE)||localStorage.getItem('campus-job-board:original-restored')||localStorage.getItem('campus-job-board:v3')||'{}')}catch{}
const S={tab:'jobs',jobs:[],mode:'loading',updated:'',meta:{},riskProfiles:[],companyMeta:{},filter:{q:'',degree:'本科',level:'全部',direction:'全部',city:'全部',source:'全部',quality:'全部',company:'',companyLabel:'',yingzhuan:false,shortlist:false},status:persisted.status||{},offerScores:persisted.offerScores||{},updatedAt:persisted.updatedAt||0,selected:null,limit:20,showAllCompanyJobs:false,viewMode:(localStorage.getItem('campus-job-board:view-mode')==='job'?'job':'company'),list:{bucket:'全部',q:'',mtp:false},sync:{secret:localStorage.getItem(SYNC_SECRET_KEY)||'',state:'idle',lastSyncedAt:null}};
const app=document.getElementById('app');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq=a=>[...new Set(a.filter(Boolean))];
function save(){S.updatedAt=Date.now();localStorage.setItem(STORAGE,JSON.stringify({status:S.status,offerScores:S.offerScores,updatedAt:S.updatedAt}));pushRemote()}
const levelClass=l=>l==='S++'||l==='S'?'s':l==='A'?'a':l==='B'?'b':l==='数据待修复'||l==='不符合硬条件'?'bad':'c';
const recLabel=l=>NORMAL_LEVELS.has(l)?`推荐 ${DISPLAY_LEVEL(l)}`:DISPLAY_LEVEL(l);

/* ---- 公司风险情报（与原站一致） ---- */
function companyKey(v=''){return String(v).replace(/[（(].*?[）)]/g,'').replace(/股份有限公司|集团有限公司|有限公司|集团|控股|中国/gi,'').replace(/[\s·,.，、_-]/g,'').toLowerCase();}
function sameCompany(a,b){const x=companyKey(a),y=companyKey(b);return Boolean(x&&y&&(x===y||x.includes(y)||y.includes(x)));}
function isYingzhuanJob(j){return Boolean(j&&(j.sourceChannel==='yingzhuan'||String(j.id||'').indexOf('yingzhuan-')===0));}
function isYingzhuanPin(j){return isYingzhuanJob(j)&&j.pin===true;}
function shortlistLookup(){
  if(!Array.isArray(window.SHORTLIST_ITEMS)) return {};
  const m={};
  for(const it of window.SHORTLIST_ITEMS){
    if(it.bucket==='pending') continue;
    const key=(it.company||'').trim().toLowerCase()+'|'+(it.title||'').trim().toLowerCase();
    if(!m[key]) m[key]=it;
  }
  return m;
}
function isShortlistJob(j){
  const m=shortlistLookup();
  const exact=(j.company||'').trim().toLowerCase()+'|'+(j.title||'').trim().toLowerCase();
  if(m[exact]) return m[exact];
  const comp=(j.company||'').trim().toLowerCase();
  const title=(j.title||'').trim().toLowerCase();
  for(const k in m){
    const [kc,kt]=k.split('|');
    if(kc===comp && kt && title && (kt.includes(title)||title.includes(kt))) return m[k];
  }
  return null;
}
const shortlistBucketLabel={sprint:'冲刺',core:'主力',safety:'保底'};
const COMPANY_JOB_CAP=3;
function applyCountByCompany(){
  const m={};
  for(const j of S.jobs){
    if(!S.status[j.id]) continue;
    const k=companyKey(j.company)||String(j.company||'');
    if(!k) continue;
    m[k]=(m[k]||0)+1;
  }
  return m;
}
function collapseByCompany(list){
  if(S.showAllCompanyJobs) return {visible:list, hidden:0, extra:{}};
  const seen={}, extra={};
  const visible=[];
  for(const j of list){
    const k=companyKey(j.company)||String(j.company||'?');
    seen[k]=(seen[k]||0)+1;
    if(seen[k]<=COMPANY_JOB_CAP) visible.push(j);
    else extra[k]=(extra[k]||0)+1;
  }
  return {visible, hidden:list.length-visible.length, extra};
}
function groupCompanies(list){
  const map=new Map();
  for(const j of list){
    const k=companyKey(j.company)||String(j.company||'?');
    if(!map.has(k)) map.set(k,{key:k, jobs:[], name:j.company});
    map.get(k).jobs.push(j);
  }
  const groups=[...map.values()].map(g=>{
    const jobs=[...g.jobs].sort((a,b)=>{
      const ay=isYingzhuanJob(a)?1:0, by=isYingzhuanJob(b)?1:0;
      if(ay!==by) return by-ay;
      return E.compare(a,b);
    });
    const recs=jobs.slice(0,COMPANY_JOB_CAP);
    const top=recs[0];
    const cm=companyMetaFor(g.name);
    const companyName=cm&&cm.fullName?cm.fullName:(g.name||'待核公司');
    const featured=jobs.some(isYingzhuanPin);
    return {...g, jobs, recs, extra:Math.max(0,jobs.length-recs.length), companyName, cm, top, featured};
  });
  groups.sort((a,b)=>{
    if(Boolean(a.featured)!==Boolean(b.featured)) return a.featured?-1:1;
    return E.compare(a.top,b.top);
  });
  return groups;
}
function pinYingzhuan(list){
  if(S.filter.company||S.filter.q||S.filter.yingzhuan) return list;
  const a=[], b=[];
  for(const j of list) (isYingzhuanPin(j)?a:b).push(j);
  return a.concat(b);
}
function mergeYingzhuan(jobs){
  const extra=window.YINGZHUAN_JOBS||[];
  if(!extra.length) return jobs||[];
  const seen=new Set((jobs||[]).map(j=>(companyKey(j.company)||'')+'|'+(String(j.title||'').replace(/\s+/g,''))));
  const add=extra.filter(j=>{
    const k=(companyKey(j.company)||'')+'|'+(String(j.title||'').replace(/\s+/g,''));
    if(seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return add.concat(jobs||[]);
}
function watchFor(job, company){
  if(job&&job.watch) return job.watch;
  const cm=companyMetaFor(company||(job&&job.company));
  return (cm&&cm.watch)||'';
}
function riskFor(company){return S.riskProfiles.find(p=>sameCompany(p.company,company)||(p.aliases||[]).some(a=>sameCompany(a,company)))||null}
const COMPANY_META_SOURCES=[{exportName:'companyMeta',urls:['https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/company-meta.js','https://cdn.jsdelivr.net/gh/lizhenhai2024-alt/AI_Job@main/src/data/company-meta.js']}];
async function loadCompanyMeta(){
  const extra=window.YINGZHUAN_META||{};
  for(const source of COMPANY_META_SOURCES){
    let blobUrl='';
    try{
      const raw=await fetchText(source.urls[0]);
      blobUrl=URL.createObjectURL(new Blob([raw],{type:'text/javascript'}));
      const mod=await import(blobUrl);
      const rows=mod[source.exportName];
      return Object.assign({}, rows&&typeof rows==='object'?rows:{}, extra);
    }catch(e){console.warn('[company-meta]',e)}
    finally{if(blobUrl)URL.revokeObjectURL(blobUrl)}
  }
  return extra;
}
function companyMetaFor(company){const m=S.companyMeta||{};if(!company)return null;if(m[company])return m[company];const k=companyKey(company);if(!k)return null;const hit=Object.keys(m).find(key=>{const kk=companyKey(key);return kk===k||(kk.includes(k)||k.includes(kk));});return hit?m[hit]:null;}
function typeLabel(type){return({layoff:'裁员/优化',restructuring:'组织重组/人员调整',intern_conversion:'实习转正/留用风险',offer_change:'校招毁约/缩招',work_intensity:'长期加班/工作强度争议',compensation:'薪资倒挂/调薪争议'})[type]||'历史事件'}
function levelLabel(level){return({A:'一手材料',B:'高可信媒体/公司回应',C:'社区经验线索',D:'未经核实传闻'})[level]||'证据待核'}
function confidenceLabel(comp={}){return comp.confidence==='high'?'高可信·企业官方披露':comp.confidence==='medium'?'中可信·二手来源待官网复核':'未披露';}
function validRiskEvent(e){return Boolean(e&&e.id&&e.type&&/^\d{4}-\d{2}-\d{2}$/.test(String(e.date||''))&&e.source&&/^https?:\/\//i.test(String(e.sourceUrl||''))&&['A','B','C','D'].includes(String(e.evidenceLevel||'')));}
function riskEvents(profile){return(profile?.events||[]).filter(validRiskEvent).filter(e=>e.evidenceLevel!=='D').sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))}
function riskSourceGuide(){return`<details class="intel-risk-source-guide"><summary>来源说明：A/B 高可信 · CampusShame / 牛客 / 脉脉等为社区线索</summary><div class="intel-risk-source-body">${RISK_SOURCE_GUIDE.map(item=>`<div class="intel-risk-source-row"><b>${esc(item.level)}级 · ${esc(item.name)}</b><div class="muted">典型来源：${esc(item.sources)}</div><div class="muted">使用原则：${esc(item.usage)}</div></div>`).join('')}<p class="intel-risk-source-foot">CampusShame 是校招案例汇总/证据索引，主要引用牛客、脉脉、知乎等公开论坛，因此默认按 C 级二手社区线索处理；若条目可回溯到 A/B 级原始证据，则以原始证据等级为准。</p></div></details>`}
function salaryText(job){const m=job?.monthlySalary||job?.compensation?.monthlyDisplay||'',a=job?.annualSalary||job?.compensation?.annualDisplay||'';if(!job?.compensation?.disclosed)return'';return [m,a].filter(Boolean).join(' · ')}

/* ---- 评价 / 筛选（与原站一致） ---- */
function evaluated(){
  return S.jobs
    .filter(j=>String(j.graduationYear||'2027').includes('2027'))
    .map(j=>({...j,_evaluation:E.evaluate(j)}))
    .filter(j=>!E.isExpired(j.deadline))
    .sort(E.compare);
}
function normalJobs(){return evaluated().filter(j=>j._evaluation.gate.passed&&j._evaluation.dataQuality.status!=='INVALID')}
function masterOnlyPool(){return evaluated().filter(j=>{const ev=j._evaluation;if(ev.dataQuality.status==='INVALID')return false;if(ev.gate.passed)return false;return ev.gate.reasons.some(r=>/硕士|研究生/.test(r));})}
function filtered(){
  const f=S.filter,q=f.q.trim().toLowerCase();
  const master=f.degree==='硕士';
  const pool=master
    ? masterOnlyPool()
    : (f.level==='数据待修复'||f.quality==='INVALID')
      ? evaluated().filter(j=>j._evaluation.gate.passed&&j._evaluation.dataQuality.status==='INVALID')
      : normalJobs();
  return pool.filter(j=>{
    const ev=j._evaluation,hay=[j.company,j.title,j.city,ev.direction,...(j.skills||[])].join(' ').toLowerCase();
    const src=j.sourceType==='official'?'官方':'二手';
    return(!q||hay.includes(q))
      &&(!f.company||sameCompany(j.company,f.company))
      &&(!f.yingzhuan||isYingzhuanJob(j))
      &&(f.yingzhuan||f.q||f.company||!isYingzhuanJob(j)||isYingzhuanPin(j))
      &&(!f.shortlist||isShortlistJob(j))
      &&(master||f.level==='全部'||ev.level===f.level||(f.level==='S'&&ev.level==='S++'))
      &&(f.direction==='全部'||ev.direction===f.direction)
      &&(f.city==='全部'||j.city===f.city)
      &&(f.source==='全部'||src===f.source)
      &&(master||f.quality==='全部'||ev.dataQuality.status===f.quality);
  });
}

/* ---- 共享组件 ---- */
function updateBox(){return`<div class="updatechip"><span class="dot ${S.mode==='live'?'':'warn'}"></span><span>${S.mode==='live'?'数据已更新':S.mode==='loading'?'正在读取岗位池':S.mode==='snapshot'?'快照数据':'回退样例'}</span><small>调研更新 ${S.updated?new Date(S.updated).toLocaleString('zh-CN',{hour12:false}):'—'}</small><small class="ver">评价规则 V1.2</small></div>`}
function nav(){const count=Object.keys(S.status).length;return`<header class="topbar"><div class="topbar-in"><div class="brand"><span class="mark"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></span><span class="brand-t">校招机会看板<small>2027届 · 英语专业</small></span></div><nav class="nav">${[['jobs','机会看板'],['pipeline',`我的投递${count?` <em>${count}</em>`:''}`],['stats','统计分析'],['offers','Offer 对比']].map(([k,n])=>`<button data-tab="${k}" class="${S.tab===k?'active':''}">${n}</button>`).join('')}</nav>${updateBox()}</div></header>`}
function statBoxes(items){return`<div class="stats">${items.map(([v,l,c])=>`<div class="stat ${c||''}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>`}
function qualityTag(q){return q.status==='VALID'?`<span class="tag ok">信息 ${q.score}/10 · VALID</span>`:q.status==='PARTIAL'?`<span class="tag warn">信息 ${q.score}/10 · 待核</span>`:`<span class="tag bad">信息 ${q.score}/10 · 待修复</span>`}
function shell(body){return`<div class="page">${nav()}${body}${modal()}</div>`}

/* ---- 岗位行 ---- */
function jobCard(j, extraCount=0, applyUsed=0){
  const v=j._evaluation, risk=v.risk.deduction;
  const masterOnly=!v.gate.passed&&(v.gate.reasons||[]).some(r=>/硕士|研究生/.test(r));
  const reason=masterOnly?'硕士及以上专属岗位，本科画像不满足硬门槛，仅供参考':(v.level==='S++'?'强直接经历 + 高职责匹配':v.level==='S'?'核心方向高度匹配':v.level==='A'?'整体适配，值得重点投':v.level==='B'?'相邻机会，可选择性投':v.level==='C'?'探索机会，优先级较低':v.level==='D'?'投入产出比较低':v.level);
  const pillText=masterOnly?'硕士':recLabel(v.level);
  const pillCls=masterOnly?'m':levelClass(v.level);
  const comp=j.compensation||{},salary=salaryText(j);
  const events=riskEvents(riskFor(j.company));
  const highRisk=events.filter(e=>['A','B'].includes(e.evidenceLevel)&&e.sentiment==='negative').length;
  const internRisk=events.filter(e=>e.type==='intern_conversion').length;
  const fit=v.dataQuality.status!=='INVALID'?`${v.fit.score}/100`:'—';
  const stage=S.status[j.id];
  const applyControl=stage?`<span class="applied">✓ ${esc(stage)}</span>`:applyUsed>=COMPANY_JOB_CAP?`<span class="cap-hit" title="每家公司最多投 3 个岗位">已达 3 岗上限</span>`:`<button class="btn ghost" data-quick-apply="${esc(j.id)}">＋ 加入已投递</button>`;
  const priCls=v.priorityScore>=85?'hi':v.priorityScore>=75?'mid':'';
  const cm=companyMetaFor(j.company);
  const companyName=cm&&cm.fullName?cm.fullName:(j.company||'待核公司');
  const extraChip=extraCount?`<button class="hidden-more" data-company="${esc(companyKey(j.company))}" data-company-label="${esc(companyName)}" title="查看该公司其余岗位">还有 ${extraCount} 个岗位</button>`:'';
  return`<article class="row">
    <div class="cell-grade"><span class="pill ${pillCls}">${esc(pillText)}</span><span class="row-reason">${esc(reason)}</span></div>
    <div class="cell-main">
      <div class="company"><button class="company-name" data-company="${esc(companyKey(j.company))}" data-company-label="${esc(companyName)}" title="查看该公司最匹配的 3 个岗位">${esc(companyName)}</button>${cm&&(cm.scale||cm.nature)?`<span class="tag" style="margin-left:8px;padding:2px 7px;font-size:11px">${esc([cm.scale,cm.nature].filter(Boolean).join(' · '))}</span>`:''}</div>
      <h3 class="row-title">${isYingzhuanJob(j)?`<span style="color:#f5a623;font-size:16px;margin-right:4px;vertical-align:middle" title="精选岗位">★</span>`:''}${esc(j.title||'待核岗位')}</h3>
      <div class="tags">
        <span class="tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${esc(j.city||'待核')}</span>
        <span class="tag">${esc(v.direction)}</span>
        <span class="tag"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${esc(j.deadline||'待核')}</span>
        ${salary?`<span class="tag pay" title="薪资来源：${esc(comp.sourceLabel||'岗位来源')}；可信度：${esc(confidenceLabel(comp))}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><line x1="6" y1="10" x2="6" y2="10"/></svg>${esc(salary)}</span>`:''}
        <span class="tag ${j.sourceType==='official'?'ok':'warn'}">${j.sourceType==='official'?'官方来源':'二手 · 投递前回官网'}</span>
        ${qualityTag(v.dataQuality)}
        ${(v.gate.reasons||[]).map(r=>`<span class="tag bad" title="硬门槛未通过">${esc(r)}</span>`).join('')}${(v.risk.items||[]).map(r=>`<span class="tag warn" title="${esc(r.label)}">${esc(r.label)} -${r.value}</span>`).join('')}
        ${highRisk?`<span class="tag bad">历史风险 A/B·${highRisk}</span>`:''}
        ${internRisk?`<span class="tag warn">实习留用线索 ${internRisk}</span>`:''}
        ${watchFor(j)?`<span class="tag bad" title="${esc(watchFor(j))}">要注意</span>`:''}
        ${(()=>{const sl=isShortlistJob(j);return sl?`<span class="tag" style="background:#fff3e0;color:#e65100;border-color:#ffcc80" title="投递清单·${shortlistBucketLabel[sl.bucket]||sl.bucket}">清单·${shortlistBucketLabel[sl.bucket]||sl.bucket}</span>`:'';})()}
        ${extraChip}
      </div>
    </div>
    <div class="cell-fit">
      <span class="cell-label">候选人适配</span>
      <div class="score"><b>${v.fit.score}</b><i>/100</i></div>
      <div class="bar"><i style="width:${Math.min(100,v.fit.score)}%"></i></div>
    </div>
    <div class="cell-pri">
      <span class="cell-label">投递优先分</span>
      <div class="score pri"><b class="${priCls}">${esc(v.priorityScore)}</b></div>
    </div>
    <div class="cell-actions">
      ${j.sourceUrl?`<a class="btn primary" target="_blank" rel="noopener" href="${esc(j.sourceUrl)}">${j.sourceType==='official'?'立即投递':'查看来源'}</a>`:''}
      <button class="btn soft" data-detail="${esc(j.id)}">评价详情</button>
      ${applyControl}
    </div>
  </article>`
}
function companyJobRow(j, applyUsed=0){
  const v=j._evaluation;
  const masterOnly=!v.gate.passed&&(v.gate.reasons||[]).some(r=>/硕士|研究生/.test(r));
  const pillText=masterOnly?'硕士':recLabel(v.level);
  const pillCls=masterOnly?'m':levelClass(v.level);
  const stage=S.status[j.id];
  const applyControl=stage?`<span class="applied">✓ ${esc(stage)}</span>`:applyUsed>=COMPANY_JOB_CAP?`<span class="cap-hit" title="每家公司最多投 3 个岗位">已达 3 岗上限</span>`:`<button class="btn ghost" data-quick-apply="${esc(j.id)}">＋ 加入已投递</button>`;
  const priCls=v.priorityScore>=85?'hi':v.priorityScore>=75?'mid':'';
  return`<div class="co-job">
    <span class="pill ${pillCls}">${esc(pillText)}</span>
    <div class="co-job-main">
      <button class="co-job-title" data-detail="${esc(j.id)}" title="${esc(j.title||'待核岗位')}">${isYingzhuanJob(j)?`<span style="color:#f5a623;font-size:13px;margin-right:2px" title="精选岗位">★</span>`:''}${esc(j.title||'待核岗位')}</button>
      <div class="co-job-sub">${esc(j.city||'待核')} · ${esc(v.direction)} · ${esc(j.deadline||'待核')}</div>
      ${watchFor(j)?`<div class="co-job-watch">要注意 ${esc(watchFor(j))}</div>`:''}
      ${(()=>{const sl=isShortlistJob(j);return sl?`<div class="co-job-watch" style="color:#e65100">投递清单·${shortlistBucketLabel[sl.bucket]||sl.bucket}</div>`:'';})()}
    </div>
    <div class="co-job-pri"><b class="${priCls}">${esc(v.priorityScore)}</b><span>优先分</span></div>
    <div class="co-job-actions">
      ${j.sourceUrl?`<a class="btn primary" target="_blank" rel="noopener" href="${esc(j.sourceUrl)}">${j.sourceType==='official'?'立即投递':'查看来源'}</a>`:''}
      <button class="btn soft" data-detail="${esc(j.id)}">评价详情</button>
      ${applyControl}
    </div>
  </div>`
}
function companyCard(g, index, applyUsed=0){
  const top=g.top, v=top._evaluation;
  const cm=g.cm;
  const priCls=v.priorityScore>=85?'hi':v.priorityScore>=75?'mid':'';
  const events=riskEvents(riskFor(g.name));
  const highRisk=events.filter(e=>['A','B'].includes(e.evidenceLevel)&&e.sentiment==='negative').length;
  const internRisk=events.filter(e=>e.type==='intern_conversion').length;
  const recPills=g.recs.map(j=>{
    const ev=j._evaluation;
    const masterOnly=!ev.gate.passed&&(ev.gate.reasons||[]).some(r=>/硕士|研究生/.test(r));
    return `<span class="pill ${masterOnly?'m':levelClass(ev.level)}">${esc(masterOnly?'硕士':DISPLAY_LEVEL(ev.level))}</span>`;
  }).join('');
  const extraChip=g.extra?`<button class="hidden-more" data-company="${esc(g.key)}" data-company-label="${esc(g.companyName)}" title="按岗位查看该公司其余岗位">还有 ${g.extra} 个岗位</button>`:`<span class="muted">已展示全部 ${g.jobs.length} 个岗位</span>`;
  return`<article class="co-card${g.featured?' featured':''}">
    <header class="co-head">
      <span class="co-rank">${String(index+1).padStart(2,'0')}</span>
      <div class="co-id">
        <div class="co-name-row">
          ${g.featured?`<span style="color:#f5a623;font-size:16px;margin-right:2px;vertical-align:middle" title="精选公司">★</span>`:''}<button class="company-name" data-company="${esc(g.key)}" data-company-label="${esc(g.companyName)}" title="只看该公司">${esc(g.companyName)}</button>
          ${cm&&(cm.scale||cm.nature)?`<span class="tag">${esc([cm.scale,cm.nature].filter(Boolean).join(' · '))}</span>`:''}
        </div>
        <div class="co-meta">
          <span class="co-pri ${priCls}">优先 ${esc(v.priorityScore)}</span>
          <span>${g.jobs.length} 个可投岗位</span>
          <span>已投 ${applyUsed}/${COMPANY_JOB_CAP}</span>
          ${recPills}
          ${highRisk?`<span class="tag bad">历史风险 A/B·${highRisk}</span>`:''}
          ${internRisk?`<span class="tag warn">实习留用线索 ${internRisk}</span>`:''}
        </div>
        ${watchFor(null, g.name)?`<div class="co-watch">要注意 ${esc(watchFor(null, g.name))}</div>`:''}
      </div>
    </header>
    <div class="co-label">${g.recs.length>=3?"三个推荐岗位":"推荐岗位"}</div>
    <div class="co-jobs">${g.recs.map(j=>companyJobRow(j, applyUsed)).join('')}</div>
    <div class="co-foot">${extraChip}<span class="muted">按岗位投递优先级取前 3</span></div>
  </article>`
}

/* ---- 机会看板页 ---- */
function quickFilters(){
  return`<span class="quick-label">快速筛选</span>${QUICK_LEVELS.map(v=>`<button class="chip ${S.filter.level===v?'active':''}" data-qlevel="${esc(v)}">${v==='全部'?'全部岗位':esc(v)}</button>`).join('')}<button class="chip official ${S.filter.source==='官方'?'active':''}" data-qofficial="1">只看官方</button><button class="chip ${S.filter.shortlist?'active':''}" data-qshortlist="1">只看清单</button>`
}
function jobsPage(){
  const all=evaluated(), normal=normalJobs(), raw=filtered();
  const applyCounts=applyCountByCompany();
  const dirs=['全部',...uniq(normal.map(x=>x._evaluation.direction))];
  const cityAll=uniq(normal.map(x=>x.city));
  const cityPrimary=E.PROFILE.targetCities.filter(c=>cityAll.includes(c));
  const cityRest=cityAll.filter(x=>!cityPrimary.includes(x)).sort((a,b)=>a.localeCompare(b,'zh-Hans-CN'));
  const cityOptionsHtml=`<option ${S.filter.city==='全部'?'selected':''}>全部</option>${cityPrimary.length?`<optgroup label="常用城市">${cityPrimary.map(x=>`<option ${S.filter.city===x?'selected':''}>${esc(x)}</option>`).join('')}</optgroup>`:''}${cityRest.length?`<optgroup label="其他城市">${cityRest.map(x=>`<option ${S.filter.city===x?'selected':''}>${esc(x)}</option>`).join('')}</optgroup>`:''}`;
  const ss=normal.filter(x=>['S++','S'].includes(x._evaluation.level)).length,a=normal.filter(x=>x._evaluation.level==='A').length,partial=normal.filter(x=>x._evaluation.dataQuality.status==='PARTIAL').length,invalid=all.filter(x=>x._evaluation.gate.passed&&x._evaluation.dataQuality.status==='INVALID').length;
  const targetDirs=[
    {label:'GTM·市场策略',key:'GTM·市场策略'},
    {label:'PMO',key:'PMO·项目管理'},
    {label:'跨境电商运营',key:'跨境电商运营'},
    {label:'外贸海外业务',key:'外贸·海外业务'},
    {label:'HR·HRBP',key:'HR·HRBP'},
    {label:'国际物流·供应链管培',key:'国际物流·供应链管培'},
  ];
  const dirCount={};
  normal.forEach(j=>{const d=j._evaluation.direction;dirCount[d]=(dirCount[d]||0)+1;});
  const dirChips=targetDirs.map(d=>`<span class="dir-chip">${esc(d.label)}<span class="dir-count">${dirCount[d.key]||0}</span></span>`).join('');
  const viewToggle=`<div class="view-toggle" role="tablist" aria-label="展示模式"><button type="button" class="view-btn ${S.viewMode==='company'?'active':''}" data-view="company">按公司</button><button type="button" class="view-btn ${S.viewMode!=='company'?'active':''}" data-view="job">按岗位</button></div>`;
  const allJobsToggle=S.viewMode==='company'?'':`<label class="all-jobs"><input type="checkbox" id="show-all-jobs" ${S.showAllCompanyJobs?'checked':''}>显示每家全部岗位</label>`;
  const companyChip=S.filter.company?`<button class="btn ghost" id="clear-company" style="margin-left:10px;padding:2px 10px;font-size:12px">公司：${esc(S.filter.companyLabel)} ×</button>`:'';
  let summary='', listHtml='', moreHtml='';
  if(S.viewMode==='company'){
    const groups=groupCompanies(raw);
    const featured=groups.filter(g=>g.featured);
    const rest=groups.filter(g=>!g.featured);
    const showSplit=false;
    if(showSplit){
      const page=rest.slice(0,S.limit);
      const featCards=featured.map((g,i)=>companyCard(g, i, applyCounts[g.key]||0)).join('');
      const restCards=page.map((g,i)=>companyCard(g, featured.length+i, applyCounts[g.key]||0)).join('');
      summary=`<div class="summary"><b>共 ${groups.length} 家公司</b><span class="muted">${raw.length} 个岗位 · ${featured.length} 家精选置顶 · 机会不大的不钉在顶部</span>${companyChip}<span class="muted">${S.filter.degree==='硕士'?'硕士及以上学历要求岗位 · 本科画像不满足硬门槛，仅作参考':'只把匹配度高、有真实机会的公司钉在顶部；其余公司仍在实时岗位池里可搜索查看'}</span></div>`;
      listHtml=`<div class="board-section"><div class="board-section-h">精选公司 · 可投优先</div><p class="board-section-note">只把匹配度扎实、有真实投递机会的公司钉在顶部。通过期望低、要驻外/理工背景、或方向偏差较大的不置顶，仍在下方实时岗位池里可搜索查看。投递前请回官网确认届别、HC 与是否仍开放。</p><div class="company-grid">${featCards}</div></div><div class="board-section"><div class="board-section-h">实时岗位池 · 按投递优先级</div><div class="company-grid">${restCards||'<div class="empty" style="grid-column:1/-1">没有符合当前筛选条件的公司</div>'}</div></div>`;
      moreHtml=rest.length>S.limit?'<p class="more"><button class="btn soft" id="more">加载更多公司</button></p>':'';
    }else{
      const page=groups.slice(0,S.limit);
      const cards=page.map((g,i)=>companyCard(g, i, applyCounts[g.key]||0)).join('');
      summary=`<div class="summary"><b>共 ${groups.length} 家公司</b><span class="muted">${raw.length} 个岗位 · 每家 3 个推荐岗位 · 按投递优先级排序</span>${companyChip}<span class="muted">${S.filter.degree==='硕士'?'硕士及以上学历要求岗位 · 本科画像不满足硬门槛，仅作参考':'公司顺序 = 该公司最匹配岗的最终推荐等级 → 候选人适配 → 投递优先分'}</span></div>`;
      listHtml=`<div class="company-grid">${cards||'<div class="empty" style="grid-column:1/-1">没有符合当前筛选条件的公司</div>'}</div>`;
      moreHtml=groups.length>S.limit?'<p class="more"><button class="btn soft" id="more">加载更多公司</button></p>':'';
    }
  }else{
    const folded=collapseByCompany(pinYingzhuan(raw));
    const lastIdx={};
    folded.visible.forEach((j,i)=>{ lastIdx[companyKey(j.company)||j.company]=i; });
    const page=folded.visible.slice(0,S.limit);
    const cards=page.map((j,i)=>{
      const k=companyKey(j.company)||j.company;
      const extra=lastIdx[k]===i?(folded.extra[k]||0):0;
      return jobCard(j, extra, applyCounts[k]||0);
    }).join('');
    summary=`<div class="summary"><b>共 ${raw.length} 个岗位</b>${folded.hidden?`<span class="muted">展示 ${folded.visible.length} · 每家最多 3 个最匹配，另隐藏 ${folded.hidden}</span>`:''}${companyChip}<span class="muted">${S.filter.degree==='硕士'?'硕士及以上学历要求岗位 · 本科画像不满足硬门槛，仅作参考':S.filter.company?(S.showAllCompanyJobs?'该公司全部可投岗位':'该公司最多 3 个最匹配岗'):'每家公司最多投 3 个岗位 · 按最终推荐等级 → 候选人适配 → 投递优先分排序'}</span></div>`;
    listHtml=`<div class="list">${cards||'<div class="empty">没有符合当前筛选条件的岗位</div>'}</div>`;
    moreHtml=folded.visible.length>S.limit?'<p class="more"><button class="btn soft" id="more">加载更多</button></p>':'';
  }
  return`<div class="wrap">
  <section class="hero"><div class="hero-in">
    <div class="hero-grid">
      <div class="hero-left">
        <h1>2027届校招机会看板</h1>
        <div class="hero-profile">
          <span class="profile-chip">湖南大学</span><span class="sep">·</span>
          <span class="profile-chip">英语专业</span><span class="sep">·</span>
          <span class="profile-chip">CET-6 / TEM-4</span>
        </div>
      </div>
      <div class="hero-dirs"><span class="dir-title">目标方向</span><div class="dir-chips">${dirChips}</div></div>
    </div>
    ${statBoxes([[normal.length,'本科可投岗位',''],[ss,'S 核心优先','s'],[a,'A级','a'],[uniq(normal.map(x=>x._evaluation.direction)).length,'覆盖方向',''],[partial,'待核岗位','warn'],[invalid,'数据待修复','bad']])}
  </div></section>
  <div class="console">
    <div class="filter-row">
      <div class="field field-search searchbox"><label>搜索</label><span class="sicon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg></span><input id="q" value="${esc(S.filter.q)}" placeholder="公司 / 岗位 / 关键词" autocomplete="off" spellcheck="false"></div>
      <div class="field"><label>学历</label><select id="degree">${['本科','硕士'].map(x=>`<option ${S.filter.degree===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>等级</label><select id="level" ${S.filter.degree==='硕士'?'disabled':''}>${LEVELS.map(x=>`<option ${S.filter.level===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="field"><label>方向</label><select id="direction">${dirs.map(x=>`<option ${S.filter.direction===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="field"><label>城市</label><select id="city">${cityOptionsHtml}</select></div>
      <div class="field"><label>信息状态</label><select id="quality" ${S.filter.degree==='硕士'?'disabled':''}>${['全部','VALID','PARTIAL','INVALID'].map(x=>`<option ${S.filter.quality===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>来源</label><select id="source">${['全部','官方','二手'].map(x=>`<option ${S.filter.source===x?'selected':''}>${x}</option>`).join('')}</select></div>
      <button id="reset" class="btn ghost" title="重置全部筛选"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/></svg>重置</button>
    </div>
    <div class="quick-row">
      ${viewToggle}
      ${quickFilters()}
      ${allJobsToggle}
      <div class="legend"><span class="pill s">S 核心优先</span><span class="pill a">A 重点投</span><span class="pill b">B 可尝试</span><span class="pill c">C / D 低优先</span></div>
      <span class="quick-note">${S.filter.degree==='硕士'?'硕士及以上岗位池 · 当前本科画像仅供参考':'仅显示<b>本科可投</b>岗位；硕士/博士及其他硬门槛岗位默认排除'}</span>
    </div>
  </div>
  ${summary}
  ${listHtml}
  ${moreHtml}
  ${dataNotes()}
  </div>`
}

function shortlistItems(){return (Array.isArray(window.SHORTLIST_ITEMS)?window.SHORTLIST_ITEMS:[]).filter(i=>i.bucket!=='pending')}
function listPage(){
  const items=shortlistItems();
  const allJobs=evaluated();
  const jobByKey={};
  for(const j of allJobs){
    const key=(j.company||'').trim().toLowerCase()+'|'+(j.title||'').trim().toLowerCase();
    if(!jobByKey[key]) jobByKey[key]=j;
  }
  function matchJob(it){
    const exact=(it.company||'').trim().toLowerCase()+'|'+(it.title||'').trim().toLowerCase();
    if(jobByKey[exact]) return jobByKey[exact];
    const comp=(it.company||'').trim().toLowerCase();
    const title=(it.title||'').trim().toLowerCase();
    for(const j of allJobs){
      const jc=(j.company||'').trim().toLowerCase();
      const jt=(j.title||'').trim().toLowerCase();
      if(jc===comp && jt && title && (jt.includes(title)||title.includes(jt))) return j;
    }
    return null;
  }
  const f=S.list||{bucket:'全部',q:'',mtp:false};
  const buckets=window.SHORTLIST_BUCKETS||{};
  const meta=window.SHORTLIST_META||{};
  const counts={sprint:0,core:0,safety:0};
  items.forEach(i=>{if(counts[i.bucket]!=null)counts[i.bucket]++;});
  const applyN=(counts.sprint+counts.core+counts.safety)||meta.apply||0;
  const q=(f.q||'').trim().toLowerCase();
  const rows=items.filter(i=>{
    if(f.bucket!=='全部'&&i.bucket!==f.bucket) return false;
    if(f.mtp&&i.channel!=='管培生') return false;
    if(q){const hay=`${i.company} ${i.title} ${i.city} ${i.track}`.toLowerCase(); if(!hay.includes(q)) return false;}
    return true;
  });
  const mtpN=items.filter(i=>i.channel==='管培生').length;
  const chip=(id,label,n)=>`<button class="chip ${f.bucket===id?'active':''}" data-list-bucket="${id}">${label}${n!=null?` ${n}`:''}</button>`;
  const bucketLabel=id=>(buckets[id]&&buckets[id].label)||({sprint:'冲刺',core:'主力',safety:'保底'}[id]||id);
  const how=f.bucket!=='全部'&&buckets[f.bucket]?`<p class="board-section-note">${esc(buckets[f.bucket].how)}</p>`:'';
  const prospectTag=p=>p==='avoid'?'<span class="sl-tag avoid">避开</span>':p==='watch'?'<span class="sl-tag watch">再看</span>':'';
  const rowHtml=rows.map((it,i)=>{
    const avoid=it.prospect==='avoid';
    const note=[it.city,it.track,it.channel==='管培生'?'管培生':'',it.note].filter(Boolean).join(' · ');
    const cta=avoid?`<span class="muted">不投</span>`:`<a class="btn primary" target="_blank" rel="noopener" href="${esc(it.url)}">去投递</a>`;
    const matched=matchJob(it);
    const v=matched?matched._evaluation:null;
    const scoreBadge=v?`<span class="sl-score" title="引擎优先分">${v.priorityScore}<em>分</em></span>`:'';
    const levelBadge=v?`<span class="sl-level lvl-${v.level}">${esc(recLabel(v.level))}</span>`:'';
    const dirBadge=v?`<span class="sl-dir">${esc(v.direction)}</span>`:'';
    const riskBadges=v&&v.risk&&v.risk.items?v.risk.items.map(r=>`<span class="sl-risk" title="${esc(r.label)}">${esc(r.label)}</span>`).join(''):'';
    const detailBtn=matched?`<button class="btn ghost" data-detail="${esc(matched.id)}">详情</button>`:'';
    const evalRow=v?`<div class="sl-eval">${scoreBadge}${levelBadge}${dirBadge}${riskBadges}</div>`:'';
    return `<li class="sl-row ${avoid?'is-avoid':''}">
      <div class="sl-idx">${i+1}</div>
      <div class="sl-main">
        <div class="sl-title">${esc(it.title)}</div>
        <div class="sl-meta">${esc(it.company)} · ${esc(note)}</div>
        ${evalRow}
        ${it.why?`<div class="sl-why">${esc(it.why)}</div>`:''}
      </div>
      <div class="sl-side">
        <span class="sl-tag ${esc(it.bucket)}">${esc(bucketLabel(it.bucket))}</span>
        ${prospectTag(it.prospect)}
        ${detailBtn}
        ${cta}
      </div>
    </li>`;
  }).join('')||'<div class="empty">没有匹配的岗位。换一个筛选。</div>';
  return `<div class="wrap">
    <section class="hero"><div class="hero-in">
      <div class="hero-left">
        <h1>2027届投递清单</h1>
        <p class="hero-lead">从实时岗位池 ${esc(String(meta.poolSize||1698))} 条收窄到可投 <b>${applyN}</b> 条。英语必须是生产资料；第一份工作决定进入哪个人才池。</p>
      </div>
      ${statBoxes([[applyN,'可投岗位',''],[counts.sprint,'冲刺','s'],[counts.core,'主力','a'],[counts.safety,'保底',''],[mtpN,'管培生通道','']])}
    </div></section>
    <section class="sl-prospect">
      <b>岗位发展前景</b>
      <p>判断 offer 只问三句：十年后这段经历还有人买单吗；三年后猎头会拿什么机会找她；积累的是她的资产还是平台的资产。纯长期回报：出海业务线 > 职能专家 > 央国企。绑定「出海这件事」，不要绑定某个品类。</p>
      <div class="sl-paths">
        <div><b>出海业务线</b><span>海外市场 → 区域负责人。驻外窗口有限，客户关系要沉淀成个人资产。</span></div>
        <div><b>职能专家线</b><span>市场 / 运营 / 项目。通用性好，天花板多停在总监。</span></div>
        <div><b>央国企国际业务</b><span>稳定，中车有背书。积累的是平台资产，离开会贬值。</span></div>
      </div>
    </section>
    <div class="console">
      <div class="quick-row sl-filters">
        ${chip('全部','全部',applyN)}
        ${chip('sprint','冲刺',counts.sprint)}
        ${chip('core','主力',counts.core)}
        ${chip('safety','保底',counts.safety)}
        <button class="chip ${f.mtp?'active':''}" data-list-mtp="1">只要管培生</button>
        <div class="field field-search searchbox sl-search"><label>搜索</label><input id="list-q" value="${esc(f.q||'')}" placeholder="公司 / 岗位 / 城市" autocomplete="off"></div>
      </div>
      ${how}
    </div>
    <ol class="sl-list">${rowHtml}</ol>
    <p class="board-section-note">fit 仅供实时看板排序，不作为本清单取舍依据。投递前请回官网确认届别、HC 与是否仍开放。教培 / 游戏 / 国内互联网已从可投清单剔除。</p>
  </div>`;
}

function dataNotes(){return`<details class="notes"><summary>评价说明 · V1.2<span class="chev"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span></summary>
  <div class="notes-grid">
    <div class="note-item"><b>AI_Job</b> 只负责发现、抓取、去重、来源核验与JD结构化；最终等级由本看板规则生成。</div>
    <div class="note-item"><b>Eligibility Gate</b>：仅硕士/研究生、博士学历岗位，以及其他本科不满足的硬门槛岗位，直接从主看板排除；本科及以上、本科/硕士均可岗位保留。</div>
    <div class="note-item"><b>Candidate Fit</b> = 职责30 + 专业语言20 + 真实经历25 + 职业方向15 + 可补足能力10。</div>
    <div class="note-item"><b>Data Quality</b> 单独0–10，不进入适配分；INVALID岗位只进入数据修复队列。</div>
    <div class="note-item"><b>风险</b> 单独扣分：长期驻外-15、高频出差-8、强销售KPI-10、高压-5等。</div>
    <div class="note-item">二手来源不降低候选人适配度，只降低信息可信度；投递前必须回企业官网核验。</div>
    <div class="note-item full"><b>V1.2 推荐层</b>：适配等级与最终推荐等级分离；卡片等级表示"最终推荐"。最终推荐按风险后的优先分调整，PARTIAL 岗位推荐上限为 B，明确海外工作地点按长期海外风险 -15 处理；服务海外市场但工作地点在国内不会触发该项。</div>
    <div class="note-item full"><b>投递配额</b>：每家公司最多投 3 个岗位。「按公司」每家展示 3 个推荐岗位，公司按该岗位投递优先级排序。「按岗位」默认每家只展示 3 个最匹配岗，可勾选「显示每家全部岗位」或点「还有 N 个岗位」查看其余。</div>
    <div class="note-item full"><b>V1.3 情报层</b>：岗位层展示月薪/年薪、来源与可信度；公司风险按 A 一手材料、B 高可信媒体、C 社区线索、D 未核实传闻分级。CampusShame、牛客、脉脉等社区内容默认只作核验线索，不参与 S/A/B，也不把匿名单帖当事实。</div>
  </div>
  <div class="note-foot">岗位池：AI_Job 岗位发现库（公司官方源优先 + 重点高校就业网 + 牛客公开职位 + 官网核验）。${S.mode==='snapshot'?'当前为内置快照数据。':'当前为实时拉取数据。'}</div>
</details>`}

/* ---- 我的投递 ---- */
function syncPanel(){return`<div class="sync-card"><div><b>云同步</b><div class="muted">${syncStatusText()}</div></div><div class="actions"><input id="sync-secret" type="password" placeholder="同步密码（在 Vercel 项目里设置）" value="${S.sync.secret?esc(S.sync.secret):''}"><button class="btn soft" id="sync-save">${S.sync.secret?'更新密码':'启用同步'}</button>${S.sync.secret?'<button class="btn ghost" id="sync-now">立即同步</button>':''}</div></div>`}
function pipelinePage(){const all=evaluated(),selected=all.filter(j=>S.status[j.id]);
  const over=Object.entries(applyCountByCompany()).filter(([,n])=>n>COMPANY_JOB_CAP);
  return`<div class="wrap">
  <div class="page-title"><h1>我的投递</h1><p>每家公司最多投 3 个岗位。超过上限的公司会标出来，请先移出再补更匹配的岗。</p></div>
  ${syncPanel()}
  <div class="toolbar"><div class="actions"><button class="btn ghost" id="export-json">导出 JSON</button><button class="btn ghost" id="export-csv">导出 CSV</button><button class="btn ghost" id="import-json">导入 JSON</button><input id="import-file" type="file" accept="application/json" class="hidden" style="display:none"></div><span class="muted">当前记录 ${selected.length} 个岗位 · 每家最多 3 个</span></div>
  ${over.length?`<p class="muted" style="margin:0 0 12px">有 ${over.length} 家公司已超过 3 岗上限，请移出适配更低的岗位。</p>`:''}
  <div class="pipeline">${STAGES.map(stage=>{const arr=selected.filter(j=>S.status[j.id]===stage);return`<div class="lane"><h3>${stage}<em>${arr.length}</em></h3><div class="lane-body">${arr.map(j=>`<div class="mini"><b data-detail="${esc(j.id)}">${esc(j.title)}</b><small>${esc(j.company)} · <span class="pill ${levelClass(j._evaluation.level)}">${esc(recLabel(j._evaluation.level))}</span></small><select class="status" data-status="${esc(j.id)}"><option value="">移出跟踪</option>${STAGES.map(x=>`<option ${S.status[j.id]===x?'selected':''}>${x}</option>`).join('')}</select></div>`).join('')||'<span class="none">暂无</span>'}</div></div>`}).join('')}</div>
  ${dataNotes()}</div>`}
function bars(rows,max){const m=max||Math.max(1,...rows.map(x=>x[1]));return rows.map(([n,v,c])=>`<div class="bar-row"><span>${esc(n)}</span><div class="barbg"><div class="barfill ${c||''}" style="width:${Math.min(100,v/m*100)}%"></div></div><b>${v}</b></div>`).join('')}
function statsPage(){
  const tracked=evaluated().filter(j=>S.status[j.id]);
  if(!tracked.length) return`<div class="wrap"><div class="page-title"><h1>统计分析</h1><p>统计的是「我的投递」里跟踪的岗位，目前还没有记录。</p></div><div class="empty">先在机会看板里给岗位点"加入已投递"，这里会显示投递阶段、推荐等级、方向和来源的统计。</div>${dataNotes()}</div>`;
  const byDir=Object.entries(tracked.reduce((m,j)=>(m[j._evaluation.direction]=(m[j._evaluation.direction]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const gradeFill={'S':'fill-s',A:'fill-a',B:'fill-b',C:'fill-c',D:'fill-c'};
  return`<div class="wrap"><div class="page-title"><h1>统计分析</h1><p>针对「我的投递」里跟踪的 ${tracked.length} 个岗位统计。</p></div>
  <div class="charts">
    <div class="chart"><h3>投递阶段</h3>${bars(STAGES.map(s=>[s,tracked.filter(j=>S.status[j.id]===s).length]))}</div>
    <div class="chart"><h3>推荐等级</h3>${bars(['S','A','B','C','D'].map(x=>[x,tracked.filter(j=>x==='S'?['S++','S'].includes(j._evaluation.level):j._evaluation.level===x).length,gradeFill[x]]))}</div>
    <div class="chart"><h3>方向分布</h3>${bars(byDir)}</div>
    <div class="chart"><h3>来源</h3>${bars([['官方',tracked.filter(j=>j.sourceType==='official').length,'fill-a'],['二手',tracked.filter(j=>j.sourceType!=='official').length,'fill-c']])}</div>
  </div>${dataNotes()}</div>`
}
function offerFit(v){return Math.round(v.fit.score/10*10)/10}
function offerScore(fit10,s){return Math.round((fit10*.3+Number(s.growth||0)*.25+Number(s.pay||0)*.2+Number(s.city||0)*.15+Number(s.pace||0)*.1)*10)/10}
function offerRow(j){
  const v=j._evaluation,fit10=offerFit(v),s=S.offerScores[j.id]||{growth:7,pay:7,city:7,pace:7,note:''};
  const salary=salaryText(j)||j.salary||'-';
  const num=(field)=>`<input type="number" min="1" max="10" value="${esc(s[field])}" data-offer="${esc(j.id)}" data-field="${field}">`;
  const total=offerScore(fit10,s);
  return`<tr><td><b>${esc(j.company)}</b><div class="muted">${esc(j.title)}</div></td><td>${esc(j.city||'-')}</td><td>${esc(salary)}</td><td class="score-hi">${fit10}</td><td>${num('growth')}</td><td>${num('pay')}</td><td>${num('city')}</td><td>${num('pace')}</td><td><b class="score-hi">${total}</b></td><td><input class="note-input" value="${esc(s.note)}" data-offer="${esc(j.id)}" data-field="note" placeholder="备注"></td></tr>`
}
function offersPage(){
  const offerJobs=evaluated().filter(j=>S.status[j.id]==='Offer');
  if(!offerJobs.length) return`<div class="wrap"><div class="page-title"><h1>Offer 对比</h1><p>在「我的投递」里把岗位状态改成 Offer 后，会自动出现在这里对比。</p></div><div class="empty">暂无处于 Offer 阶段的岗位。</div></div>`;
  const sorted=[...offerJobs].sort((a,b)=>{const sa=S.offerScores[a.id]||{growth:7,pay:7,city:7,pace:7},sb=S.offerScores[b.id]||{growth:7,pay:7,city:7,pace:7};return offerScore(offerFit(b._evaluation),sb)-offerScore(offerFit(a._evaluation),sa)});
  return`<div class="wrap"><div class="page-title"><h1>Offer 对比</h1><p>候选人适配 30%（自动取自岗位评价）· 成长 25% · 薪酬 20% · 城市 15% · 工作节奏 10%（后四项自己按 1–10 打分）</p></div>
  <div class="table-card"><table><thead><tr><th>公司 / 岗位</th><th>城市</th><th>薪资</th><th>适配</th><th>成长</th><th>薪酬</th><th>城市偏好</th><th>节奏</th><th>综合</th><th>备注</th></tr></thead><tbody>${sorted.map(offerRow).join('')}</tbody></table></div></div>`
}

/* ---- 岗位JD详情 ---- */
const JD_REQ_HEAD=/(岗位要求|任职要求|任职资格|申请要求|资格要求|职位要求)\s*[:：]?/;
const JD_DUTY_HEAD=/(岗位职责|工作职责|职责描述|工作内容)\s*[:：]?/;
function splitJdBlob(raw){
  const text=String(raw||'').replace(/\r\n/g,'\n').replace(/<br\s*\/?>/gi,'\n').trim();
  if(!text) return {duties:'',reqs:''};
  let duties=text, reqs='';
  const reqIdx=text.search(JD_REQ_HEAD);
  if(reqIdx>=0){
    const m=text.slice(reqIdx).match(JD_REQ_HEAD);
    reqs=text.slice(reqIdx+(m?m[0].length:0)).trim();
    duties=text.slice(0,reqIdx).trim();
  }
  duties=duties.replace(JD_DUTY_HEAD,'\n').trim();
  reqs=reqs.replace(JD_REQ_HEAD,'\n').trim();
  return {duties,reqs};
}
function jdItems(text){
  let t=String(text||'').trim();
  if(!t) return [];
  t=t.replace(new RegExp(JD_DUTY_HEAD.source+'|'+JD_REQ_HEAD.source,'g'),'\n');
  t=t.replace(/(?=(?:[1-9]\d?[、．])|(?:[1-9]\d?\.(?!\d))|(?:[1-9]\d?\))|(?:（[1-9]\d?）)|[①②③④⑤⑥⑦⑧⑨⑩])/g,'\n');
  let lines=t.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const out=[];
  for(const line of lines){
    if(/^[1-9①②③④⑤⑥⑦⑧⑨⑩]/.test(line) || line.length<20 || !/；/.test(line)){ out.push(line); continue; }
    const parts=line.split(/；/).map(s=>s.trim()).filter(Boolean);
    if(parts.length>=2) out.push(...parts);
    else out.push(line);
  }
  return out.map(s=>s.replace(/[；;]+$/g,'').trim()).filter(Boolean);
}
function jobDetailSection(j){
  let desc=String(j.jobDescription||'').trim();
  let req=String(j.jobRequirements||'').trim();
  if(!req){
    const split=splitJdBlob(desc||String(j.description||''));
    if(split.reqs){ desc=split.duties; req=split.reqs; }
    else if(!desc) desc=split.duties;
  }else{
    desc=desc.replace(JD_DUTY_HEAD,'\n').trim();
    req=req.replace(JD_REQ_HEAD,'\n').trim();
  }
  if(!desc && !req) desc=String(j.description||'').trim();
  const fmt=t=>jdItems(t).map(s=>`<li>${esc(s)}</li>`).join('');
  const parts=[];
  if(desc) parts.push(`<div class="jd-block"><h4>岗位职责</h4><ul class="jd-list">${fmt(desc)}</ul></div>`);
  if(req) parts.push(`<div class="jd-block"><h4>任职要求</h4><ul class="jd-list">${fmt(req)}</ul></div>`);
  if(!parts.length) return '<div class="note" style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:11px 14px">该岗位暂无结构化JD文本，可点击下方"打开官方职位"查看原文。</div>';
  return parts.join('');
}
/* ---- 评价详情抽屉 ---- */
function detailBox(label,value){return`<div class="cell"><span>${esc(label)}</span><b>${esc(value||'未披露')}</b></div>`}
function riskEventRow(event){
  const link=/^https?:\/\//i.test(String(event?.sourceUrl||''))?`<a class="intel-link" href="${esc(event.sourceUrl)}" target="_blank" rel="noopener">证据</a>`:'';
  return`<div class="intel-event"><div class="intel-event-head"><b>${esc(event.date||'日期待核')} · ${esc(typeLabel(event.type))}</b><span class="tag ${['A','B'].includes(event.evidenceLevel)?'warn':''}">${esc(event.evidenceLevel)}级 · ${esc(levelLabel(event.evidenceLevel))}</span></div><div class="intel-event-title">${esc(event.title||'历史事件')}</div>${event.summary?`<div class="muted intel-event-summary">${esc(event.summary)}</div>`:''}<div class="muted intel-event-foot">范围：${esc(event.scope||'待核')} · 来源：${esc(event.source||'待核')}${link?` · ${link}`:''}</div></div>`
}
function modal(){if(!S.selected)return'';const j=evaluated().find(x=>x.id===S.selected);if(!j)return'';const v=j._evaluation,p=v.fit.parts,r=v.reasoning;
  const comp=j.compensation||{},events=riskEvents(riskFor(j.company));
  const cm=companyMetaFor(j.company);
  const companyName=cm&&cm.fullName?cm.fullName:(j.company||'待核公司');
  const partRows=[['职责',p.responsibility,30,r.responsibility],['专业语言',p.majorLanguage,20,r.major],['真实经历',p.experience,25,r.experience],['方向价值',p.careerValue,15,r.career],['可补足能力',p.learnability,10,r.learnability]].map(([l,s,m,t])=>`<div class="part"><div class="part-head"><span>${l}</span><b>${s}<i> /${m}</i></b></div><div class="bar"><i style="width:${Math.min(100,s/m*100)}%"></i></div><p class="muted">${esc(t)}</p></div>`).join('');
  return`<div class="drawer-bg" data-close="1"><aside class="drawer">
    <header class="drawer-head">
      <button class="drawer-close" data-close="1" title="关闭"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <div class="company"><button class="company-name" data-company="${esc(companyKey(j.company))}" data-company-label="${esc(companyName)}" title="查看该公司最匹配的 3 个岗位">${esc(companyName)}</button>${cm&&(cm.scale||cm.nature)?`<span class="tag" style="margin-left:8px;padding:2px 7px;font-size:11px">${esc([cm.scale,cm.nature].filter(Boolean).join(' · '))}</span>`:''}</div>
      <h2>${esc(j.title||'待核岗位')}</h2>
      <div class="drawer-kpis">
        <span><b>${esc(recLabel(v.level))}</b> 最终推荐</span>
        <span><b>${v.fit.score}</b> 适配 /100</span>
        <span><b>−${v.risk.deduction}</b> 风险</span>
        <span><b>${v.priorityScore}</b> 优先分</span>
      </div>
    </header>
    <div class="drawer-body">
      <section><h3>五维适配</h3>${partRows}</section>
      ${watchFor(j)?`<section><h3>要注意</h3><div class="note" style="background:var(--bad-bg);color:var(--bad);border:0">${esc(watchFor(j))}</div></section>`:''}
      <section><h3>岗位JD</h3>${jobDetailSection(j)}</section>
      <section><h3>薪资情报</h3><div class="kv">${detailBox('月薪',j.monthlySalary||comp.monthlyDisplay)}${detailBox('年薪',j.annualSalary||comp.annualDisplay)}${detailBox('原始薪资',comp.raw||j.salary)}${detailBox('薪资来源',comp.sourceLabel)}${detailBox('薪资可信度',confidenceLabel(comp))}${detailBox('薪资证据',comp.evidence)}</div><p class="note">月薪/年薪只使用来源页或JD明确披露数字；未写薪数时仅按12薪估算，并显式标记。不擅自加入年终奖、股票、补贴或绩效奖金。</p></section>
      <section><h3>公司往年风险事件 / 实习留用线索</h3>${riskSourceGuide()}${events.length?events.slice(0,5).map(riskEventRow).join(''):'<div class="note" style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:11px 14px">暂无满足"时间 + 来源 + 可追溯链接 + 证据等级"要求的已录入事件；这不等于"无风险"，仍需核验具体团队和年份。</div>'}<p class="note">历史事件不等于当前状态；A/B级可作为高可信风险情报，C级社区经验只用于面试反问/核验，D级传闻默认隐藏。公司历史风险不参与本看板 S/A/B 或 Candidate Fit 计算。</p></section>
      <section><h3>Gate / 风险</h3><div class="tags">${v.gate.reasons.map(x=>`<span class="tag bad">× ${esc(x)}</span>`).join('')}${v.risk.items.map(x=>`<span class="tag warn">${esc(x.label)} -${x.value}</span>`).join('')}${v.gate.passed&&!v.risk.items.length?'<span class="tag ok">硬条件通过 · 无明显风险</span>':''}</div></section>
      <section><h3>证据化理由</h3><div class="part"><div style="font-size:12.5px">${esc(r.experience)}</div><div class="muted" style="margin-top:6px">${esc(r.dataQuality)}</div></div></section>
      ${j.sourceUrl?`<a class="btn primary wide cta" target="_blank" rel="noopener" href="${esc(j.sourceUrl)}">${j.sourceType==='official'?'打开官方职位':'查看来源并回官网核验'}</a>`:''}
    </div>
  </aside></div>`
}

/* ---- 渲染 / 数据加载 ---- */
function render(){const body=S.tab==='jobs'?jobsPage():S.tab==='list'?listPage():S.tab==='pipeline'?pipelinePage():S.tab==='stats'?statsPage():offersPage();app.innerHTML=shell(body)}
function parseModule(raw){const a=raw.search(/export\s+const\s+liveJobs\s*=/),s=raw.indexOf('[',a),m=raw.search(/export\s+const\s+discoveryMeta/),segment=raw.slice(s,m<0?raw.length:m),end=segment.lastIndexOf(']');if(a<0||s<0||end<0)throw Error('岗位池格式异常');const jobs=JSON.parse(segment.slice(0,end+1));let meta={};if(m>=0){const ms=raw.indexOf('{',m),me=raw.lastIndexOf('}');if(ms>0&&me>ms)try{meta=JSON.parse(raw.slice(ms,me+1))}catch{}}return{jobs,meta}}
async function fetchText(url){const c=new AbortController(),timer=setTimeout(()=>c.abort(),9000);try{const res=await fetch(url,{cache:'no-store',signal:c.signal});if(!res.ok)throw Error(String(res.status));return await res.text();}finally{clearTimeout(timer)}}
async function loadJobsAndMeta(){
  for(const url of DATA_URLS){try{const {jobs,meta}=parseModule(await fetchText(url));if(!jobs.length)throw Error('empty');return{jobs:mergeYingzhuan(jobs),meta,mode:'live'}}catch(err){console.warn('[board data]',err)}}
  if(EMBEDDED_JOBS.length) return{jobs:mergeYingzhuan(EMBEDDED_JOBS),meta:EMBEDDED_META,mode:'snapshot'};
  return{jobs:mergeYingzhuan(fb),meta:{updatedAt:'',source:'内置示例'},mode:'fallback'};
}
async function loadRiskSet(source){
  for(const url of source.urls){let blobUrl='';try{const raw=await fetchText(url);blobUrl=URL.createObjectURL(new Blob([raw],{type:'text/javascript'}));const mod=await import(blobUrl);const rows=mod[source.exportName];return Array.isArray(rows)?rows:[]}catch(e){console.warn(`[risk ${source.exportName}]`,e)}finally{if(blobUrl)URL.revokeObjectURL(blobUrl)}}
  return EMBEDDED_RISK[source.fallback]||[];
}
async function loadRiskProfiles(){const groups=await Promise.all(RISK_SOURCES.map(loadRiskSet));return groups.flat()}
async function load(){
  const [{jobs,meta,mode},riskProfiles,companyMeta]=await Promise.all([loadJobsAndMeta(),loadRiskProfiles(),loadCompanyMeta()]);
  S.jobs=jobs;S.meta=meta;S.mode=mode;S.riskProfiles=riskProfiles;S.companyMeta=companyMeta||{};
  S.updated=meta.updatedAt||jobs[0]?.discoveredAt||'';
  render();
  if(S.sync.secret) pullRemote();
}

/* ---- 云同步（尽力而为，失败静默回退本地） ---- */
async function syncFetch(method,body){
  const headers={};
  if(S.sync.secret) headers['X-Board-Secret']=S.sync.secret;
  if(body) headers['Content-Type']='application/json';
  const res=await fetch('/api/state',{method,headers,body:body?JSON.stringify(body):undefined});
  if(!res.ok) throw new Error(String(res.status));
  return res.json();
}
async function pullRemote(){
  S.sync.state='syncing';
  try{
    const remote=await syncFetch('GET');
    if((remote.updatedAt||0)>S.updatedAt){
      S.status=remote.status||{};S.offerScores=remote.offerScores||{};S.updatedAt=remote.updatedAt||Date.now();
      localStorage.setItem(STORAGE,JSON.stringify({status:S.status,offerScores:S.offerScores,updatedAt:S.updatedAt}));
    }else if(S.updatedAt>(remote.updatedAt||0)){
      await syncFetch('POST',{status:S.status,offerScores:S.offerScores,updatedAt:S.updatedAt});
    }
    S.sync.state='synced';S.sync.lastSyncedAt=Date.now();
  }catch(err){console.warn('[sync pull]',err);S.sync.state='offline'}
  if(S.tab==='pipeline') render();
}
async function pushRemote(){
  if(!S.sync.secret) return;
  S.sync.state='syncing';
  try{
    await syncFetch('POST',{status:S.status,offerScores:S.offerScores,updatedAt:S.updatedAt});
    S.sync.state='synced';S.sync.lastSyncedAt=Date.now();
  }catch(err){console.warn('[sync push]',err);S.sync.state='offline'}
  if(S.tab==='pipeline') render();
}
function syncStatusText(){
  if(!S.sync.secret) return '未启用云同步 · 仅保存在本浏览器';
  if(S.sync.state==='syncing') return '同步中…';
  if(S.sync.state==='offline') return '云端不可用 · 当前仅本地保存';
  if(S.sync.lastSyncedAt) return `已于 ${new Date(S.sync.lastSyncedAt).toLocaleTimeString('zh-CN',{hour12:false})} 同步`;
  return '已启用云同步';
}
function download(name,text,type='application/json'){const a=document.createElement('a'),blob=new Blob([text],{type});a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}

/* ---- 搜索框：输入法（IME）组合期间不重渲染，组合结束才应用搜索 ---- */
let composing=false;
function applySearch(el){
  S.filter.q=el.value;
  const pos=el.selectionStart;
  render();
  const q=document.getElementById('q');
  q?.focus();q?.setSelectionRange(pos,pos);
}
app.addEventListener('compositionstart',ev=>{if(ev.target.id==='q'||ev.target.id==='list-q')composing=true});
app.addEventListener('compositionend',ev=>{if(ev.target.id==='q'){composing=false;applySearch(ev.target)} if(ev.target.id==='list-q'){composing=false;S.list=S.list||{bucket:'全部',q:'',mtp:false};S.list.q=ev.target.value;render();}});

app.addEventListener('click',ev=>{
  const view=ev.target.closest('[data-view]')?.dataset.view;
  if(view){S.viewMode=view;try{localStorage.setItem('campus-job-board:view-mode',view)}catch{}S.limit=view==='company'?20:40;S.selected=null;render();return}
  const tab=ev.target.closest('[data-tab]')?.dataset.tab;if(tab){S.tab=tab;S.selected=null;render();return}
  const detail=ev.target.closest('[data-detail]')?.dataset.detail;if(detail){S.selected=detail;render();return}
  if(S.selected){
    if(ev.target.closest('.drawer-close')){S.selected=null;render();return}
    if(ev.target.classList?.contains('drawer-bg')){S.selected=null;render();return}
    if(ev.target.closest('.drawer'))return;
  }
  if(ev.target.id==='reset'){S.filter={q:'',degree:'本科',level:'全部',direction:'全部',city:'全部',source:'全部',quality:'全部',company:'',companyLabel:'',yingzhuan:false,shortlist:false};render();return}
  if(ev.target.id==='clear-company'){S.filter.company='';S.filter.companyLabel='';S.showAllCompanyJobs=false;render();return}
  const moreBtn=ev.target.closest('.hidden-more');
  if(moreBtn){
    S.filter.company=moreBtn.dataset.company;
    S.filter.companyLabel=moreBtn.dataset.companyLabel||moreBtn.dataset.company;
    S.showAllCompanyJobs=true;
    S.viewMode='job';
    try{localStorage.setItem('campus-job-board:view-mode','job')}catch{}
    S.limit=40;
    render();
    return;
  }
  const companyBtn=ev.target.closest('[data-company]');if(companyBtn){S.filter.company=companyBtn.dataset.company;S.filter.companyLabel=companyBtn.dataset.companyLabel||companyBtn.dataset.company;S.showAllCompanyJobs=false;S.limit=40;render();return}
  if(ev.target.id==='more'){S.limit+=S.viewMode==='company'?16:40;render();return}
  const qlevel=ev.target.closest('[data-qlevel]')?.dataset.qlevel;if(qlevel!==undefined){S.filter.level=qlevel;render();return}
  if(ev.target.closest('[data-qofficial]')){S.filter.source=S.filter.source==='官方'?'全部':'官方';render();return}
  if(ev.target.closest('[data-qshortlist]')){S.filter.shortlist=!S.filter.shortlist;render();return}
  const listBucket=ev.target.closest('[data-list-bucket]')?.dataset.listBucket;
  if(listBucket!==undefined){S.list=S.list||{bucket:'全部',q:'',mtp:false};S.list.bucket=listBucket;render();return}
  if(ev.target.closest('[data-list-mtp]')){S.list=S.list||{bucket:'全部',q:'',mtp:false};S.list.mtp=!S.list.mtp;render();return}
  const quickApply=ev.target.closest('[data-quick-apply]')?.dataset.quickApply;if(quickApply){
    const job=S.jobs.find(j=>j.id===quickApply);
    const k=job?companyKey(job.company):'';
    if(job && !S.status[quickApply] && (applyCountByCompany()[k]||0)>=COMPANY_JOB_CAP){
      alert('每家公司最多投 3 个岗位。请先移出一个，或只保留最匹配的三个。');
      return;
    }
    S.status[quickApply]='已投递';save();render();return;
  }
  if(ev.target.id==='export-json'){download('campus-job-board-applications.json',JSON.stringify({status:S.status,offerScores:S.offerScores,exportedAt:new Date().toISOString()},null,2));return}
  if(ev.target.id==='export-csv'){const rows=[['岗位ID','公司','岗位','状态','等级','适配度','优先分','信息质量'],...evaluated().filter(j=>S.status[j.id]).map(j=>[j.id,j.company,j.title,S.status[j.id],DISPLAY_LEVEL(j._evaluation.level),j._evaluation.fit.score,j._evaluation.priorityScore,j._evaluation.dataQuality.status])];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');download('campus-job-board-applications.csv',csv,'text/csv;charset=utf-8');return}
  if(ev.target.id==='import-json'){document.getElementById('import-file')?.click();return}
  if(ev.target.id==='sync-save'){const v=(document.getElementById('sync-secret')?.value||'').trim();S.sync.secret=v;if(v)localStorage.setItem(SYNC_SECRET_KEY,v);else localStorage.removeItem(SYNC_SECRET_KEY);if(v)pullRemote();else render();return}
  if(ev.target.id==='sync-now'){pullRemote();return}
});
app.addEventListener('input',ev=>{
  if(ev.target.id==='list-q'){
    if(ev.isComposing || composing) return;
    S.list=S.list||{bucket:'全部',q:'',mtp:false};
    S.list.q=ev.target.value;
    const pos=ev.target.selectionStart;
    render();
    const q=document.getElementById('list-q');
    q?.focus();q?.setSelectionRange(pos,pos);
    return;
  }
  if(ev.target.id!=='q') return;
  if(ev.isComposing || composing) return;
  applySearch(ev.target);
});
app.addEventListener('change',ev=>{
  if(['level','direction','city','source','quality','degree'].includes(ev.target.id)){S.filter[ev.target.id]=ev.target.value;render();return}
  if(ev.target.id==='show-all-jobs'){S.showAllCompanyJobs=ev.target.checked;S.limit=40;render();return}
  const offerId=ev.target.dataset.offer,field=ev.target.dataset.field;
  if(offerId&&field){S.offerScores[offerId]=S.offerScores[offerId]||{growth:7,pay:7,city:7,pace:7,note:''};S.offerScores[offerId][field]=field==='note'?ev.target.value:Number(ev.target.value);save();render();return}
  const id=ev.target.dataset.status;if(id!==undefined){
    if(ev.target.value){
      const job=S.jobs.find(j=>j.id===id);
      const already=Boolean(S.status[id]);
      const k=job?companyKey(job.company):'';
      if(job && !already && (applyCountByCompany()[k]||0)>=COMPANY_JOB_CAP){
        alert('每家公司最多投 3 个岗位。请先移出一个，或只保留最匹配的三个。');
        ev.target.value='';
        return;
      }
      S.status[id]=ev.target.value;
    } else delete S.status[id];
    save();render();return;
  }
  if(ev.target.id==='import-file'&&ev.target.files?.[0]){const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);S.status=data.status||{};S.offerScores=data.offerScores||{};save();render()}catch{alert('JSON 文件格式不正确')}};reader.readAsText(ev.target.files[0])}
});
render();load();
})();