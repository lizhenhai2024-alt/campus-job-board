(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.CareerFit2027=api;
  if(typeof document!=='undefined') api.initUI();
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const VERSION='1.1';
  const STORAGE='campus-job-board:career-fit:v1';
  const DIRECTIONS={
    gtm:{name:'GTM·市场策略',board:'GTM·市场策略',roles:'海外GTM、Product Marketing、区域市场、市场研究、营销策划'},
    sales:{name:'外贸·海外业务',board:'外贸·海外业务',roles:'海外销售、国际业务、BD、KA、渠道、外贸商务'},
    pmo:{name:'PMO·项目管理',board:'PMO·项目管理',roles:'PMO、国际项目、客户项目、交付协调、项目助理'},
    ecom:{name:'跨境电商运营',board:'跨境电商运营',roles:'Amazon、TikTok Shop、独立站、平台/品类运营'},
    brand:{name:'品牌·内容·用户运营',board:'品牌·内容·用户运营',roles:'品牌、海外社媒、内容、达人、PR、社区/用户运营'},
    ops:{name:'产品·业务运营',board:'产品·业务运营',roles:'产品运营、业务运营、服务运营、客户成功、客户运营'},
    supply:{name:'国际物流·供应链',board:'国际物流·供应链管培',roles:'订单、关务、国际物流、采购、计划、供应链运营'},
    analysis:{name:'经营·商业分析',board:'经营·商业分析',roles:'商业分析、经营分析、行业研究、市场分析、战略支持'},
    hr:{name:'HR·HRBP',board:'HR·HRBP',roles:'HRBP、招聘、培训、人才发展、雇主品牌、海外HR'}
  };
  const INTEREST=[
    ['研究竞品，分析他们凭什么这么定价和讲卖点','gtm'],['给一款新产品想清楚卖给谁、凭什么让人买','gtm'],['写产品的对外话术、宣传材料和上市方案','gtm'],['跟进一次新品上市，协调各部门按节奏推进','gtm'],
    ['给海外客户写开发信、报价，跟进订单','sales'],['参加展会，现场和外国客户洽谈','sales'],['维护一批海外经销商，处理他们的需求和抱怨','sales'],['用英语和国外客户开会、谈条件','sales'],
    ['把一个复杂项目拆成任务表，盯每个节点按时完成','pmo'],['发现项目要延期时提前预警，协调资源补救','pmo'],['组织跨部门会议，记录决议并追踪落实','pmo'],['维护项目文档、风险清单和进度看板','pmo'],
    ['优化商品页面的标题、图片和描述，提高转化','ecom'],['调整广告关键词和出价，把获客成本降下来','ecom'],['分析销量数据，判断哪个品该加大投入','ecom'],['盯库存和补货节奏，避免断货或积压','ecom'],
    ['策划并制作社媒内容，看数据反馈再调整','brand'],['找海外达人合作，谈条件、盯内容产出','brand'],['运营用户社群，回应用户、组织活动','brand'],['给品牌想一个能让人记住的表达方式','brand'],
    ['梳理一条业务流程，找出卡点并推动改进','ops'],['支持业务团队日常运转，做报表、跟数据','ops'],['设计一套规则或机制，让事情能自动跑起来','ops'],['协调多方资源，把一件跨团队的事推成','ops'],
    ['安排货物的运输方式和路线，控成本和时效','supply'],['处理清关、单证和合规认证的事务','supply'],['跟进供应商交期，协调生产和发货','supply'],['盯库存周转，让仓库既不断货也不积压','supply'],
    ['分析业务数据，找出增长或下滑的原因','analysis'],['做市场和行业研究，输出一份分析报告','analysis'],['为管理层决策提供数据和建议','analysis'],['建模型测算不同方案的结果，比较优劣','analysis'],
    ['面试候选人，判断他适不适合这个岗位','hr'],['设计培训方案，帮助员工成长','hr'],['处理员工关系问题，做沟通和协调','hr'],['做招聘计划、薪酬或绩效方案','hr']
  ];
  const EVIDENCE=[
    ['认真分析过一个产品/品牌为什么成功，并形成自己的观点',['gtm','analysis']],
    ['写过面向外部的宣传性文字，并且真的被使用',['gtm','brand']],
    ['用英语和外国人完成过一次实际事务沟通（不是闲聊）',['sales','pmo','ops']],
    ['主动联系过不认识的人，并促成过下一步',['sales','brand','hr']],
    ['统筹过多人参与、有截止日期的事情并按时完成',['pmo','ops']],
    ['做过详细计划表或进度跟踪，并真正照着执行',['pmo','supply']],
    ['研究过商品为什么卖得好，或做过线上买卖/平台运营',['ecom','gtm']],
    ['用表格或工具分析数据，并据此做过决定',['ecom','analysis','ops']],
    ['运营过账号或持续创作过内容',['brand']],
    ['组织过线上/线下社群或活动',['brand','hr']],
    ['发现过流程问题，并推动把它改掉',['ops','pmo']],
    ['做过需要协调多个团队/多方角色的事情',['pmo','ops','sales']],
    ['做过精确、不能出错的事务性工作并坚持下来',['supply','pmo']],
    ['处理过物流、采购、订单或库存相关事务',['supply','ecom']],
    ['做过数据分析，并写成结构化报告',['analysis','gtm']],
    ['系统研究过一个行业/公司，并输出明确结论',['analysis','gtm']],
    ['参与过招新、面试、选拔或人才评估',['hr']],
    ['长期做过团队协调、沟通或矛盾调解',['hr','ops']]
  ];
  const WORK=[
    ['长期驻外（一到两年起）',['能接受','看地区和时长','接受不了'],['sales','supply']],
    ['英语作为日常工作语言',['完全可以','吃力但能上','不想天天用'],['sales','gtm','brand','ecom','pmo']],
    ['工作里有大量重复性事务',['能','偶尔可以','受不了'],['supply','pmo','ops']],
    ['结果按季度或年度结算、短期看不到反馈',['能','有点难','需要即时反馈'],['sales','gtm']],
    ['高频出差',['能','偶尔可以','不能'],['sales','pmo','supply']],
    ['每天大量和人沟通',['喜欢','还行','消耗很大'],['sales','hr','pmo','ops']],
    ['主动承受拒绝',['能','有点难','很难'],['sales','brand','hr']],
    ['每天处理大量数字和表格',['能','还行','不喜欢'],['analysis','ecom','supply','ops']]
  ];

  const blankState=()=>({interest:{},evidence:{},work:{}});
  function normalizeState(raw){
    const s=raw&&typeof raw==='object'?raw:{};
    return {interest:s.interest&&typeof s.interest==='object'?s.interest:{},evidence:s.evidence&&typeof s.evidence==='object'?s.evidence:{},work:s.work&&typeof s.work==='object'?s.work:{}};
  }
  function counts(state){
    state=normalizeState(state);
    return {a:Object.keys(state.interest).length,b:Object.keys(state.evidence).length,c:Object.keys(state.work).length,done:Object.keys(state.interest).length+Object.keys(state.evidence).length+Object.keys(state.work).length,total:INTEREST.length+EVIDENCE.length+WORK.length};
  }
  function interestScores(state){
    state=normalizeState(state);const out={};
    Object.keys(DIRECTIONS).forEach(k=>{const ids=INTEREST.map((q,i)=>q[1]===k?i:null).filter(x=>x!==null);const vals=ids.filter(i=>state.interest[i]!=null).map(i=>+state.interest[i]);out[k]={answered:vals.length,total:ids.length,score:vals.length?Math.round(((vals.reduce((a,b)=>a+b,0)/vals.length)-1)/4*100):null};});
    return out;
  }
  function evidenceScores(state){
    state=normalizeState(state);const out={};
    Object.keys(DIRECTIONS).forEach(k=>{const ids=EVIDENCE.map((q,i)=>q[1].includes(k)?i:null).filter(x=>x!==null);const vals=ids.filter(i=>state.evidence[i]!=null).map(i=>+state.evidence[i]);out[k]={answered:vals.length,total:ids.length,score:vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/(vals.length*3)*100):null};});
    return out;
  }
  function conflicts(state){
    state=normalizeState(state);const out={};Object.keys(DIRECTIONS).forEach(k=>out[k]=[]);
    WORK.forEach((q,i)=>{if(+state.work[i]===2)q[2].forEach(k=>out[k].push(q[0]));else if(+state.work[i]===1&&['主动承受拒绝','长期驻外（一到两年起）','每天大量和人沟通'].includes(q[0]))q[2].forEach(k=>out[k].push('需确认：'+q[0]));});return out;
  }
  function profile(state){
    state=normalizeState(state);const c=counts(state),pct=Math.round(c.done/c.total*100),I=interestScores(state),E=evidenceScores(state),C=conflicts(state);
    const ranking=Object.keys(DIRECTIONS).map(k=>({key:k,name:DIRECTIONS[k].name,board:DIRECTIONS[k].board,interest:I[k].score,evidence:E[k].score,confidence:Math.round((((I[k].answered/I[k].total)||0)+((E[k].answered/E[k].total)||0))/2*100),conflicts:C[k]})).sort((a,b)=>(b.interest??-1)-(a.interest??-1));
    return {version:VERSION,completion:pct,counts:c,interestScores:I,evidenceScores:E,workstyleConflicts:C,ranking,generatedAt:new Date().toISOString()};
  }

  let state=blankState(),active=false,styleInjected=false,observer=null;
  function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function load(){try{state=normalizeState(JSON.parse(localStorage.getItem(STORAGE)||'{}'));}catch{state=blankState();}}
  function save(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch{};renderCareer();decorateBoard();}
  function labelInterest(s){if(s==null)return '—';if(s>=75)return '强兴趣';if(s>=60)return '有兴趣';if(s>=45)return '中性/待验证';return '兴趣较弱';}
  function labelEvidence(s){if(s==null)return '—';if(s>=70)return '证据较强';if(s>=45)return '有一定证据';if(s>=20)return '证据偏弱';return '几乎无证据';}

  function injectStyle(){
    if(styleInjected||typeof document==='undefined')return;styleInjected=true;
    const s=document.createElement('style');s.id='career-fit-style';s.textContent=`
#career-fit-root{display:none;min-height:100vh;background:var(--paper,#F2F4F8);color:var(--ink,#0B1B33)}
#career-fit-root.active{display:block}.cf-wrap{max-width:1120px;margin:0 auto;padding:22px 24px 56px}.cf-hero{border-radius:18px;padding:28px 30px;color:#fff;background:radial-gradient(800px 260px at 92% -20%,rgba(36,86,230,.34),transparent 62%),linear-gradient(180deg,#0E213F,#0B1B33);box-shadow:0 18px 40px -26px rgba(11,27,51,.55)}.cf-eyebrow{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9FB5E9;font-weight:800}.cf-hero h1{font-size:30px;line-height:1.2;margin:6px 0 10px}.cf-hero p{max-width:860px;color:#C5D1E3;font-size:14px}.cf-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}.cf-btn{border:1px solid var(--line-strong,#C6CFDB);background:#fff;color:var(--ink,#0B1B33);padding:8px 13px;border-radius:9px;cursor:pointer;font-weight:650;font-size:13px}.cf-btn.primary{background:var(--acc,#2456E6);border-color:var(--acc,#2456E6);color:#fff}.cf-btn.dark{background:var(--ink,#0B1B33);border-color:var(--ink,#0B1B33);color:#fff}.cf-progress{position:sticky;top:60px;z-index:35;margin-top:14px;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border:1px solid var(--line,#E2E7EF);border-radius:12px;padding:11px 14px;box-shadow:var(--shadow)}.cf-progress-line{height:7px;background:#E7EBF1;border-radius:99px;overflow:hidden}.cf-progress-bar{height:100%;background:var(--acc,#2456E6);border-radius:99px}.cf-progress-meta{display:flex;justify-content:space-between;gap:12px;margin-top:6px;font-size:12px;color:var(--muted,#66768C)}.cf-section{padding:28px 0 6px}.cf-section-h{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:14px}.cf-section h2{font-size:24px;margin:0}.cf-part{font-size:11px;letter-spacing:1.2px;color:var(--acc,#2456E6);font-weight:800}.cf-lead{color:var(--muted,#66768C);font-size:13px;margin-top:4px;max-width:820px}.cf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cf-card{background:#fff;border:1px solid var(--line,#E2E7EF);border-radius:14px;padding:16px;box-shadow:0 5px 18px -18px rgba(11,27,51,.3)}.cf-qhead{display:flex;gap:9px;align-items:flex-start}.cf-qnum{font-variant-numeric:tabular-nums;color:var(--acc,#2456E6);font-weight:800;min-width:31px}.cf-qtext{font-weight:650}.cf-scale{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:12px}.cf-choice{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:12px}.cf-choice.three{grid-template-columns:repeat(3,1fr)}.cf-opt{position:relative}.cf-opt input{position:absolute;opacity:0;pointer-events:none}.cf-opt span{display:block;border:1px solid var(--line-strong,#C6CFDB);border-radius:9px;padding:8px 6px;text-align:center;cursor:pointer;background:#fff;font-size:12px}.cf-opt input:checked+span{background:var(--acc-soft,#EAF0FF);border-color:var(--acc,#2456E6);color:var(--acc-deep,#1B46C0);box-shadow:inset 0 0 0 1px var(--acc,#2456E6);font-weight:700}.cf-scale-note{display:flex;justify-content:space-between;color:var(--muted,#66768C);font-size:11px;margin-top:5px}.cf-note{padding:13px 15px;border-radius:11px;background:var(--warn-bg,#FCF0DF);border:1px solid #E9D2AA;color:#7A4A0A;margin:12px 0}.cf-results{margin-top:16px}.cf-rank{display:grid;gap:9px}.cf-rankrow{display:grid;grid-template-columns:190px 1fr 52px auto;gap:10px;align-items:center;background:#fff;border:1px solid var(--line,#E2E7EF);border-radius:11px;padding:10px 12px}.cf-track{height:9px;background:#E9EDF3;border-radius:99px;overflow:hidden}.cf-fill{height:100%;background:var(--acc,#2456E6);border-radius:99px}.cf-score{text-align:right;font-weight:800}.cf-buckets,.cf-dirgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.cf-bucket,.cf-dir{background:#fff;border:1px solid var(--line,#E2E7EF);border-radius:14px;padding:16px}.cf-bucket h3,.cf-dir h3{margin:0 0 5px;font-size:17px}.cf-small{font-size:12px;color:var(--muted,#66768C)}.cf-pill{display:inline-flex;padding:3px 8px;border-radius:99px;font-size:11px;font-weight:700;margin:3px 4px 3px 0;background:#EDF1F5}.cf-pill.ok{background:#DFF5EB;color:#0C6E4A}.cf-pill.warn{background:#FCF0DF;color:#8A5209}.cf-pill.bad{background:#FDE9EE;color:#B42949}.cf-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:12px 0}.cf-metric{padding:9px;background:#F6F8FB;border-radius:9px}.cf-metric b{display:block;font-size:20px}.cf-metric span{font-size:10.5px;color:var(--muted,#66768C)}.cf-special{background:#F6F8FB;border:1px solid var(--line,#E2E7EF);border-radius:14px;padding:15px;margin-top:14px}.cf-special h3{margin:0 0 7px}.cf-linkrow{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:11px}.cf-disclaimer{font-size:12px;color:var(--muted,#66768C);margin:18px 0 0}.cf-board-summary{margin:14px 0 0;padding:11px 14px;border:1px solid #CFE0FF;background:#F4F7FF;border-radius:11px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px}.cf-board-summary b{color:var(--ink,#0B1B33)}.cf-board-summary .cf-open{margin-left:auto;border:0;background:transparent;color:var(--acc,#2456E6);font-weight:700;cursor:pointer}.cf-top-back{margin-left:auto}.cf-nav-btn{position:relative}.cf-nav-btn .cf-badge{font-style:normal;font-size:10px;background:var(--acc,#2456E6);color:#fff;border-radius:99px;padding:1px 6px;margin-left:4px}.cf-hidden{display:none!important}
@media(max-width:800px){.cf-wrap{padding:16px 14px 42px}.cf-grid,.cf-buckets,.cf-dirgrid{grid-template-columns:1fr}.cf-rankrow{grid-template-columns:125px 1fr 40px}.cf-rankrow .cf-btn{grid-column:1/-1}.cf-choice{grid-template-columns:1fr 1fr}.cf-choice.three{grid-template-columns:1fr}.cf-hero h1{font-size:25px}.cf-progress{top:60px}.cf-metrics{grid-template-columns:repeat(3,1fr)}}`;
    document.head.appendChild(s);
  }

  function ensureRoot(){
    let root=document.getElementById('career-fit-root');if(root)return root;
    root=document.createElement('div');root.id='career-fit-root';document.body.appendChild(root);return root;
  }
  function navBadge(){const p=profile(state);return p.completion?` <em class="cf-badge">${p.completion}%</em>`:'';}
  function decorateNav(){
    if(typeof document==='undefined')return;const nav=document.querySelector('#app .nav');if(!nav)return;
    if(!nav.querySelector('[data-career-fit]')){const b=document.createElement('button');b.type='button';b.className='cf-nav-btn';b.dataset.careerFit='1';b.innerHTML='职业测评'+navBadge();nav.appendChild(b);}else{const b=nav.querySelector('[data-career-fit]');b.innerHTML='职业测评'+navBadge();b.classList.toggle('active',active);}
  }
  function decorateBoard(){
    if(typeof document==='undefined'||active)return;decorateNav();
    const hero=document.querySelector('#app .hero');if(!hero||document.querySelector('#app .cf-board-summary'))return;
    const p=profile(state);if(p.completion<60)return;
    const top=p.ranking.filter(x=>x.interest!=null).slice(0,3);if(!top.length)return;
    const box=document.createElement('div');box.className='cf-board-summary';box.innerHTML=`<b>Career Fit</b><span>当前${p.completion<100?'初步':'完整'}画像：</span>${top.map((x,i)=>`<span class="cf-pill ${i===0?'ok':''}">${i+1}. ${esc(x.name)} ${x.interest}</span>`).join('')}<button class="cf-open" data-career-fit="1">查看测评 →</button>`;
    hero.insertAdjacentElement('afterend',box);
  }
  function open(){active=true;injectStyle();const app=document.getElementById('app');if(app)app.style.display='none';const r=ensureRoot();r.classList.add('active');renderCareer();window.scrollTo({top:0,behavior:'smooth'});}
  function close(){active=false;const r=document.getElementById('career-fit-root');if(r)r.classList.remove('active');const app=document.getElementById('app');if(app)app.style.display='';decorateNav();decorateBoard();window.scrollTo({top:0,behavior:'smooth'});}
  function goJobs(boardDirection){
    close();setTimeout(()=>{const jobsBtn=document.querySelector('#app [data-tab="jobs"]');if(jobsBtn)jobsBtn.click();setTimeout(()=>{const sel=document.getElementById('direction');if(sel&&[...sel.options].some(o=>o.value===boardDirection)){sel.value=boardDirection;sel.dispatchEvent(new Event('change',{bubbles:true}));}window.scrollTo({top:0,behavior:'smooth'});},0);},0);
  }
  function renderTopbar(){return `<header class="topbar"><div class="topbar-in"><div class="brand"><span class="mark"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-6"/></svg></span><span class="brand-t">Career Fit<small>2027届 · 英语专业</small></span></div><button class="cf-btn cf-top-back" data-cf-close="1">← 返回机会看板</button></div></header>`;}
  function renderCareer(){
    if(!active||typeof document==='undefined')return;const root=ensureRoot(),p=profile(state),I=p.interestScores,E=p.evidenceScores,C=p.workstyleConflicts;
    const ranking=p.ranking;
    const interestHtml=INTEREST.map((q,i)=>`<div class="cf-card"><div class="cf-qhead"><div class="cf-qnum">${String(i+1).padStart(2,'0')}</div><div class="cf-qtext">${esc(q[0])}</div></div><div class="cf-scale">${[1,2,3,4,5].map(v=>`<label class="cf-opt"><input type="radio" name="cfi${i}" value="${v}" data-cf-kind="interest" data-cf-i="${i}" ${+state.interest[i]===v?'checked':''}><span>${v}</span></label>`).join('')}</div><div class="cf-scale-note"><span>完全不想</span><span>很想做</span></div></div>`).join('');
    const evidenceHtml=EVIDENCE.map((q,i)=>`<div class="cf-card"><div class="cf-qhead"><div class="cf-qnum">${String(i+1).padStart(2,'0')}</div><div class="cf-qtext">${esc(q[0])}</div></div><div class="cf-choice">${[['0','没做过'],['1','课程/类似经历'],['2','真实项目/实习'],['3','有成果可证明']].map(([v,t])=>`<label class="cf-opt"><input type="radio" name="cfe${i}" value="${v}" data-cf-kind="evidence" data-cf-i="${i}" ${String(state.evidence[i])===v?'checked':''}><span>${t}</span></label>`).join('')}</div></div>`).join('');
    const workHtml=WORK.map((q,i)=>`<div class="cf-card"><div class="cf-qhead"><div class="cf-qnum">${String(i+1).padStart(2,'0')}</div><div class="cf-qtext">能接受：${esc(q[0])}？</div></div><div class="cf-choice three">${q[1].map((t,v)=>`<label class="cf-opt"><input type="radio" name="cfw${i}" value="${v}" data-cf-kind="work" data-cf-i="${i}" ${+state.work[i]===v?'checked':''}><span>${esc(t)}</span></label>`).join('')}</div></div>`).join('');
    let results='';
    if(p.completion<60){results=`<div class="cf-note"><b>暂不生成结论。</b> 完成度不足 60%。未答题按缺失处理，不会按 0 分拉低结果。</div>`;}
    else{
      const buckets={main:[],invest:[],capable:[],pause:[]};Object.keys(DIRECTIONS).forEach(k=>{const i=I[k].score,e=E[k].score;if(i==null||e==null)return;if(i>=60&&e>=45)buckets.main.push(k);else if(i>=60&&e<45)buckets.invest.push(k);else if(i<60&&e>=45)buckets.capable.push(k);else buckets.pause.push(k);});
      const bdefs=[['主攻区','想做 · 也有证据','main','ok'],['值得投入','想做 · 证据还不够','invest','warn'],['能做但需确认意愿','证据不差 · 兴趣一般','capable','warn'],['暂不优先','当前兴趣与证据都弱','pause','bad']];
      const tracks=[];if((I.brand.score??0)>=60&&+state.work[1]!==2)tracks.push('语言·本地化·国际内容：Localization、英文内容、语言质量、国际传播');if((I.ops.score??0)>=60&&+state.work[5]!==2)tracks.push('客户成功·国际服务：Customer Success、服务运营、英文交付/客户运营');if((I.sales.score??0)>=60&&+state.work[0]!==2)tracks.push('海外/驻外业务：进一步区分渠道、KA、区域销售、国际商务');if((I.analysis.score??0)>=60&&+state.work[7]!==2)tracks.push('数据强化赛道：商业分析、经营分析、市场分析，并补 Excel/SQL/可视化作品');
      results=`<div class="cf-note"><b>${p.completion<100?'当前是初步画像。':'完整画像已生成。'}</b> ${p.completion<100?`已完成 ${p.completion}%，个别方向排序仍可能变化。`:'优先看“兴趣 + 证据 + 工作方式冲突”的组合，不要只看第一名。'}</div><div class="cf-rank">${ranking.map((x,idx)=>`<div class="cf-rankrow"><div>${idx+1}. ${esc(x.name)}</div><div class="cf-track"><div class="cf-fill" style="width:${Math.max(0,x.interest??0)}%"></div></div><div class="cf-score">${x.interest??'—'}</div><button class="cf-btn" data-cf-jobs="${esc(x.board)}">看岗位</button></div>`).join('')}</div><div class="cf-buckets">${bdefs.map(([t,sub,key,cls])=>`<div class="cf-bucket"><h3>${t}</h3><div class="cf-small">${sub}</div><div style="margin-top:7px">${buckets[key].length?buckets[key].map(k=>`<span class="cf-pill ${cls}">${esc(DIRECTIONS[k].name)}</span>`).join(''):'<span class="cf-small">这一格目前为空</span>'}</div></div>`).join('')}</div><div class="cf-special"><h3>专项赛道提示</h3>${tracks.length?`<ul>${tracks.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<div class="cf-small">目前没有形成足够明确的专项赛道信号；这不是负面结论。</div>'}</div><div class="cf-dirgrid">${ranking.map(x=>{const i=I[x.key],e=E[x.key],conf=C[x.key];let action='继续补全信息';if(i.score!=null&&e.score!=null){if(i.score>=60&&e.score>=45)action='优先用真实岗位和面试反馈验证';else if(i.score>=60)action='先做一个 2–3 周可展示的小项目，补行为证据';else if(e.score>=45)action='你能做，但要确认是否愿意长期做';else action='暂不主攻，把时间给更高兴趣/高证据方向';}return `<div class="cf-dir"><h3>${esc(DIRECTIONS[x.key].name)}</h3><div class="cf-small">${esc(DIRECTIONS[x.key].roles)}</div><div class="cf-metrics"><div class="cf-metric"><b>${i.score??'—'}</b><span>兴趣 · ${labelInterest(i.score)}</span></div><div class="cf-metric"><b>${e.score??'—'}</b><span>证据 · ${labelEvidence(e.score)}</span></div><div class="cf-metric"><b>${x.confidence}%</b><span>结论可信度</span></div></div><div><b>工作方式：</b>${conf.length?conf.map(v=>`<span class="cf-pill warn">${esc(v)}</span>`).join(''):'<span class="cf-pill ok">暂无明显冲突</span>'}</div><div class="cf-linkrow"><span><b>下一步：</b>${esc(action)}</span><button class="cf-btn primary" data-cf-jobs="${esc(x.board)}">查看岗位</button></div></div>`;}).join('')}</div>`;
    }
    root.innerHTML=`${renderTopbar()}<main class="cf-wrap"><section class="cf-hero"><div class="cf-eyebrow">Career Fit · 2027届企业校招 · 英语专业</div><h1>九个求职方向，哪个真的适合你</h1><p>分三部分：你想做什么（兴趣）、你做过什么（证据）、你能接受什么（工作方式）。这不是标准化心理测验，而是求职方向诊断：结果用于探索和筛选，不修改机会看板的 S/A/B、Candidate Fit 或投递优先分。</p><div class="cf-toolbar"><button class="cf-btn primary" data-cf-results="1">看结果</button><button class="cf-btn" data-cf-export="1">导出画像 JSON</button><button class="cf-btn" data-cf-reset="1">清空重测</button></div></section><div class="cf-progress"><div class="cf-progress-line"><div class="cf-progress-bar" style="width:${p.completion}%"></div></div><div class="cf-progress-meta"><span>已完成 ${p.counts.done} / ${p.counts.total}</span><span>${p.completion<60?'完成 60% 后生成初步画像':p.completion<100?'当前为初步画像；答完可提高可信度':'已完成，可查看完整画像'}</span></div></div><section class="cf-section"><div class="cf-section-h"><div><div class="cf-part">PART 1</div><h2>你有多想做这些事</h2><p class="cf-lead">36 项具体工作内容，按“你有多愿意每天做这件事”打分。不用管会不会做，只问想不想。</p></div></div><div class="cf-grid">${interestHtml}</div></section><section class="cf-section"><div class="cf-section-h"><div><div class="cf-part">PART 2</div><h2>你实际做过哪些</h2><p class="cf-lead">这部分问事实，不问意愿。0=没做过；1=课程/类似经历；2=真实项目/实习；3=有成果、作品或数据可证明。</p></div></div><div class="cf-grid">${evidenceHtml}</div></section><section class="cf-section"><div class="cf-section-h"><div><div class="cf-part">PART 3</div><h2>你能接受什么</h2><p class="cf-lead">这些不计入方向能力分，只提示岗位现实中的工作方式冲突。</p></div></div><div class="cf-grid">${workHtml}</div></section><section class="cf-section" id="cf-results"><div class="cf-part">RESULT</div><h2>职业方向画像</h2><div class="cf-results">${results}</div><p class="cf-disclaimer">Career Fit 只生成 Candidate Career Profile。具体岗位能不能投、S/A/B、专业 Gate、公司风险与是否值得投，仍由机会看板规则决定。</p></section></main>`;
  }
  function exportProfile(){const data={...profile(state),answers:normalizeState(state)};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='career-fit-profile-v1.1.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
  function reset(){if(confirm('确定清空 Career Fit 全部作答？')){state=blankState();try{localStorage.removeItem(STORAGE);}catch{};renderCareer();decorateNav();decorateBoard();}}
  function handleClick(ev){
    const openBtn=ev.target.closest('[data-career-fit]');if(openBtn){open();return;}
    if(ev.target.closest('[data-cf-close]')){close();return;}
    const jobs=ev.target.closest('[data-cf-jobs]');if(jobs){goJobs(jobs.dataset.cfJobs);return;}
    if(ev.target.closest('[data-cf-results]')){document.getElementById('cf-results')?.scrollIntoView({behavior:'smooth'});return;}
    if(ev.target.closest('[data-cf-export]')){exportProfile();return;}
    if(ev.target.closest('[data-cf-reset]')){reset();return;}
  }
  function handleChange(ev){const t=ev.target;if(!t.matches('[data-cf-kind]'))return;const kind=t.dataset.cfKind,i=t.dataset.cfI;if(!['interest','evidence','work'].includes(kind))return;state[kind][i]=+t.value;save();}
  function initUI(){
    injectStyle();load();ensureRoot();document.addEventListener('click',handleClick);document.addEventListener('change',handleChange);decorateNav();decorateBoard();
    observer=new MutationObserver(()=>{if(!active){decorateNav();decorateBoard();}});observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  }
  return {VERSION,STORAGE,DIRECTIONS,INTEREST,EVIDENCE,WORK,blankState,normalizeState,counts,interestScores,evidenceScores,conflicts,profile,initUI};
});
