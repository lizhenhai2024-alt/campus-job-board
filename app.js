/**
 * campus-job-board app — merged app-v1.1.js + ui-v1.2-patch.js + intelligence-v1.3-patch.js.
 *
 * Previously these were three separate scripts: the base renderer, plus two "patch" layers that
 * ran a MutationObserver on #app and rewrote/injected DOM nodes after every render (decision-grid,
 * quick filters, recommendation pill wording, salary/risk tags, modal salary+risk sections). That
 * meant two independent network fetches of the same live-jobs.js data file, and behavior that lived
 * in string/DOM matching instead of the render functions themselves.
 *
 * This version renders everything directly in the template functions (jobCard/jobsPage/modal) and
 * fetches jobs + company risk history exactly once, in parallel, at startup.
 */
(()=>{'use strict';
const E=window.CampusScoring;
if(!E) throw new Error('CampusScoring not loaded');

const DATA_URLS=['https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/live-jobs.js','https://cdn.jsdelivr.net/gh/lizhenhai2024-alt/AI_Job@main/src/data/live-jobs.js'];
const RISK_SOURCES=[
  {exportName:'companyRiskHistory',urls:['https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/company-risk-history.js','https://cdn.jsdelivr.net/gh/lizhenhai2024-alt/AI_Job@main/src/data/company-risk-history.js']},
  {exportName:'priorityCompanyRiskHistory',urls:['https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/company-risk-history-priority.js','https://cdn.jsdelivr.net/gh/lizhenhai2024-alt/AI_Job@main/src/data/company-risk-history-priority.js']}
];
const RISK_SOURCE_GUIDE=[
  {level:'A',name:'一手材料',sources:'公司公告/官网、交易所/监管、法院/裁判文书、公司官方公众号/微博',usage:'可直接确认事件主体、时间与事实边界。'},
  {level:'B',name:'高可信媒体 / 公司回应',sources:'Reuters、第一财经、界面、澎湃等，或媒体明确引用公司回应',usage:'用于确认公开事件；不把报道范围扩大到未提及的团队、地区或年份。'},
  {level:'C',name:'社区经验线索',sources:'CampusShame、牛客、脉脉、知乎、V2EX 等',usage:'用于发现校招毁约、实习留用、工作强度等线索；保留原帖/快照，不能由单帖外推成全公司事实。'},
  {level:'D',name:'未经核实传闻',sources:'无法追溯原帖、仅截图转述或单一匿名爆料',usage:'默认隐藏，不作为事实、黑名单或投递结论。'}
];
const STORAGE='campus-job-board:v1.1';
const SYNC_SECRET_KEY='campus-job-board:sync-secret';
const STAGES=['已收藏','已投递','笔试','面试','Offer','淘汰'];
const LEVELS=['全部','S++','S','A','B','C','D','数据待修复'];
const QUICK_LEVELS=['全部','S++','S','A','B'];
const NORMAL_LEVELS=new Set(['S++','S','A','B','C','D']);
const fb=[{id:'fallback-1',company:'示例公司',title:'海外业务运营（2027届）',city:'深圳',graduationYear:'2027',roleFamily:['海外运营'],languages:['英语'],experienceKeywords:['海外业务','市场研究','客户信息'],preferenceTags:['国际业务','出海'],source:'回退示例',sourceType:'secondary',sourceUrl:'https://example.com/job',deadline:'2026-12-31',description:'实时岗位池不可用时的示例岗位，英语用于海外业务沟通。'}];

let persisted={};try{persisted=JSON.parse(localStorage.getItem(STORAGE)||localStorage.getItem('campus-job-board:original-restored')||localStorage.getItem('campus-job-board:v3')||'{}')}catch{}
const S={tab:'jobs',jobs:[],mode:'loading',updated:'',meta:{},riskProfiles:[],filter:{q:'',level:'全部',direction:'全部',city:'全部',source:'全部',quality:'全部'},status:persisted.status||{},offers:persisted.offers||[],updatedAt:persisted.updatedAt||0,selected:null,limit:40,sync:{secret:localStorage.getItem(SYNC_SECRET_KEY)||'',state:'idle',lastSyncedAt:null}};
const app=document.getElementById('app');
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uniq=a=>[...new Set(a.filter(Boolean))];
function save(){S.updatedAt=Date.now();localStorage.setItem(STORAGE,JSON.stringify({status:S.status,offers:S.offers,updatedAt:S.updatedAt}));pushRemote()}
const levelClass=l=>l==='S++'||l==='S'?'s':l==='A'?'a':l==='B'?'b':'c';
const recLabel=l=>NORMAL_LEVELS.has(l)?`推荐 ${l}`:l;

// ---- company risk lookup (was intelligence-v1.3-patch.js) ----
function companyKey(v=''){return String(v).replace(/[（(].*?[）)]/g,'').replace(/股份有限公司|集团有限公司|有限公司|集团|控股|中国/gi,'').replace(/[\s·,.，、_-]/g,'').toLowerCase();}
function sameCompany(a,b){const x=companyKey(a),y=companyKey(b);return Boolean(x&&y&&(x===y||x.includes(y)||y.includes(x)));}
function riskFor(company){return S.riskProfiles.find(p=>sameCompany(p.company,company)||(p.aliases||[]).some(a=>sameCompany(a,company)))||null}
function typeLabel(type){return({layoff:'裁员/优化',restructuring:'组织重组/人员调整',intern_conversion:'实习转正/留用风险',offer_change:'校招毁约/缩招',work_intensity:'长期加班/工作强度争议',compensation:'薪资倒挂/调薪争议'})[type]||'历史事件'}
function levelLabel(level){return({A:'一手材料',B:'高可信媒体/公司回应',C:'社区经验线索',D:'未经核实传闻'})[level]||'证据待核'}
function confidenceLabel(comp={}){return comp.confidence==='high'?'高可信·企业官方披露':comp.confidence==='medium'?'中可信·二手来源待官网复核':'未披露';}
function validRiskEvent(e){return Boolean(e&&e.id&&e.type&&/^\d{4}-\d{2}-\d{2}$/.test(String(e.date||''))&&e.source&&/^https?:\/\//i.test(String(e.sourceUrl||''))&&['A','B','C','D'].includes(String(e.evidenceLevel||'')));}
function riskEvents(profile){return(profile?.events||[]).filter(validRiskEvent).filter(e=>e.evidenceLevel!=='D').sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))}
function riskSourceGuide(){return`<details class="intel-risk-source-guide"><summary>来源说明：A/B 高可信 · CampusShame / 牛客 / 脉脉等为社区线索</summary><div class="intel-risk-source-body">${RISK_SOURCE_GUIDE.map(item=>`<div class="intel-risk-source-row"><b>${esc(item.level)}级 · ${esc(item.name)}</b><div class="muted">典型来源：${esc(item.sources)}</div><div class="muted">使用原则：${esc(item.usage)}</div></div>`).join('')}<p class="intel-risk-source-foot">CampusShame 是校招案例汇总/证据索引，主要引用牛客、脉脉、知乎等公开论坛，因此默认按 C 级二手社区线索处理；若条目可回溯到 A/B 级原始证据，则以原始证据等级为准。</p></div></details>`}
function salaryText(job){const m=job?.monthlySalary||job?.compensation?.monthlyDisplay||'',a=job?.annualSalary||job?.compensation?.annualDisplay||'';if(!job?.compensation?.disclosed)return'';return [m,a].filter(Boolean).join(' · ')}

// ---- evaluation / filtering ----
function evaluated(){
  return S.jobs
    .filter(j=>String(j.graduationYear||'2027').includes('2027'))
    .map(j=>({...j,_evaluation:E.evaluate(j)}))
    .filter(j=>!E.isExpired(j.deadline))
    .sort(E.compare);
}
function normalJobs(){return evaluated().filter(j=>j._evaluation.gate.passed&&j._evaluation.dataQuality.status!=='INVALID')}
function filtered(){
  const f=S.filter,q=f.q.trim().toLowerCase();
  const pool=(f.level==='数据待修复'||f.quality==='INVALID')
    ? evaluated().filter(j=>j._evaluation.gate.passed&&j._evaluation.dataQuality.status==='INVALID')
    : normalJobs();
  return pool.filter(j=>{
    const ev=j._evaluation,hay=[j.company,j.title,j.city,ev.direction,...(j.skills||[])].join(' ').toLowerCase();
    const src=j.sourceType==='official'?'官方':'二手';
    return(!q||hay.includes(q))&&(f.level==='全部'||ev.level===f.level)&&(f.direction==='全部'||ev.direction===f.direction)&&(f.city==='全部'||j.city===f.city)&&(f.source==='全部'||src===f.source)&&(f.quality==='全部'||ev.dataQuality.status===f.quality);
  });
}

// ---- shared chrome ----
function updateBox(){return`<div class="update"><b><span class="dot ${S.mode==='live'?'':'warn'}"></span>${S.mode==='live'?'数据已更新':S.mode==='loading'?'正在读取岗位池':'回退数据模式'}</b><small>调研更新 ${S.updated?new Date(S.updated).toLocaleString('zh-CN',{hour12:false}):'—'}</small><small>评价规则 V1.2</small></div>`}
function nav(){const count=Object.keys(S.status).length;return`<div class="topbar"><div class="toprow"><div class="brand">2027届校招机会看板 · 英语专业</div><div class="nav">${[['jobs','机会看板'],['pipeline',`我的投递 ${count}`],['stats','统计分析'],['offers','Offer 对比']].map(([k,n])=>`<button data-tab="${k}" class="${S.tab===k?'active':''}">${n}</button>`).join('')}</div></div></div>`}
function shell(body){return`<div class="page">${nav()}${body}${modal()}</div>`}
function statBoxes(items){return`<div class="stats">${items.map(([v,l])=>`<div class="stat"><strong>${v}</strong><span>${l}</span></div>`).join('')}</div>`}
function qualityTag(q){return q.status==='VALID'?`<span class="tag ok">信息 ${q.score}/10 · VALID</span>`:q.status==='PARTIAL'?`<span class="tag warn">信息 ${q.score}/10 · 待核</span>`:`<span class="tag bad">信息 ${q.score}/10 · 待修复</span>`}

// ---- job card (now includes decision-grid + salary/risk tags inline) ----
function jobCard(j){
  const v=j._evaluation, risk=v.risk.deduction, reason=v.level==='S++'?'强直接经历 + 高职责匹配':v.level==='S'?'核心方向高度匹配':v.level==='A'?'整体适配，值得重点投':v.level==='B'?'相邻机会，可选择性投':v.level==='C'?'探索机会，优先级较低':v.level==='D'?'投入产出比较低':v.level;
  const comp=j.compensation||{},salary=salaryText(j);
  const events=riskEvents(riskFor(j.company));
  const highRisk=events.filter(e=>['A','B'].includes(e.evidenceLevel)&&e.sentiment==='negative').length;
  const internRisk=events.filter(e=>e.type==='intern_conversion').length;
  const fit=v.dataQuality.status!=='INVALID'?`${v.fit.score} / 100`:'—';
  return`<article class="card job"><div><div class="company">${esc(j.company||'待核公司')}</div><div class="jobtitle">${esc(j.title||'待核岗位')}</div><div class="meta"><span>📍 ${esc(j.city||'待核')}</span><span>🧭 ${esc(v.direction)}</span><span>🗓 ${esc(j.deadline||'待核')}</span><span>${esc(j.source||'来源待核')}</span></div><div class="decision-grid"><div class="decision-cell"><span>岗位方向</span><b>${esc(v.direction)}</b></div><div class="decision-cell fit"><span>候选人适配</span><b>${fit}</b></div><div class="decision-cell priority"><span>投递优先分</span><b>${esc(v.priorityScore)}</b></div></div><div class="decision-why"><strong>推荐判断</strong><span>${esc(reason)}</span></div><div class="tags">${salary?`<span class="tag ok" title="薪资来源：${esc(comp.sourceLabel||'岗位来源')}；可信度：${esc(confidenceLabel(comp))}">💰 ${esc(salary)}</span><span class="tag ${comp.confidence==='high'?'ok':'warn'}">${comp.confidence==='high'?'薪资·高可信':'薪资·待官网复核'}</span>`:''}<span class="tag ${j.sourceType==='official'?'ok':'warn'}" data-secondary="1">${j.sourceType==='official'?'官方来源':'二手来源 · 投递前回官网'}</span><span data-secondary="1">${qualityTag(v.dataQuality)}</span>${risk?`<span class="tag warn" data-risk="1">风险 -${risk}</span>`:''}${highRisk?`<span class="tag warn" data-risk="1">历史风险 A/B·${highRisk}</span>`:''}${internRisk?`<span class="tag" data-risk="1">实习留用线索 ${internRisk}</span>`:''}</div></div><div class="match"><div><div class="level"><span class="pill ${levelClass(v.level)}">${esc(recLabel(v.level))}</span></div></div><div class="actions">${j.sourceUrl?`<a class="btn ${j.sourceType==='official'?'primary':'soft'}" target="_blank" rel="noopener" href="${esc(j.sourceUrl)}">${j.sourceType==='official'?'立即投递':'查看来源'}</a>`:''}<button class="btn" data-detail="${esc(j.id)}">评价详情</button><select class="status" data-status="${esc(j.id)}"><option value="">投递状态</option>${STAGES.map(x=>`<option ${S.status[j.id]===x?'selected':''}>${x}</option>`).join('')}</select></div></div></article>`
}

function quickFilters(){
  return`<div class="decision-quick"><span class="decision-quick-label">快速筛选</span>${QUICK_LEVELS.map(v=>`<button class="quick-btn ${S.filter.level===v?'active':''}" data-qlevel="${esc(v)}">${v==='全部'?'全部岗位':esc(v)}</button>`).join('')}<button class="quick-btn official ${S.filter.source==='官方'?'active':''}" data-qofficial="1">只看官方</button></div>`
}

function jobsPage(){
  const all=evaluated(), normal=normalJobs(), list=filtered(), dirs=['全部',...uniq(normal.map(x=>x._evaluation.direction))],cities=['全部',...uniq(normal.map(x=>x.city))];
  const ss=normal.filter(x=>['S++','S'].includes(x._evaluation.level)).length,a=normal.filter(x=>x._evaluation.level==='A').length,partial=normal.filter(x=>x._evaluation.dataQuality.status==='PARTIAL').length,invalid=all.filter(x=>x._evaluation.gate.passed&&x._evaluation.dataQuality.status==='INVALID').length;
  return`<section class="hero"><div><h1>2027届校招机会看板</h1><div class="subtitle">湖南大学 · 英语专业 · CET-6 / TEM-4 ｜ 目标方向：GTM·市场策略 / PMO / 跨境电商运营 / 外贸海外业务 / HR·HRBP / 国际物流供应链管培</div></div>${updateBox()}</section>${statBoxes([[normal.length,'本科可投岗位'],[ss,'S++ / S'],[a,'A级'],[uniq(normal.map(x=>x._evaluation.direction)).length,'覆盖方向'],[partial,'待核岗位'],[invalid,'数据待修复']])}${S.mode==='fallback'?'<div class="notice">实时数据源暂不可用，当前显示回退样例。</div>':''}<div class="card filters filters6"><div class="field"><label>搜索</label><input id="q" value="${esc(S.filter.q)}" placeholder="公司 / 岗位 / 关键词"></div><div class="field"><label>等级</label><select id="level">${LEVELS.map(x=>`<option ${S.filter.level===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>方向</label><select id="direction">${dirs.map(x=>`<option ${S.filter.direction===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>城市</label><select id="city">${cities.map(x=>`<option ${S.filter.city===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>信息状态</label><select id="quality">${['全部','VALID','PARTIAL','INVALID'].map(x=>`<option ${S.filter.quality===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>来源</label><select id="source">${['全部','官方','二手'].map(x=>`<option ${S.filter.source===x?'selected':''}>${x}</option>`).join('')}</select></div><button id="reset" class="btn">重置</button></div><div class="ruleline">${quickFilters()}<div class="legend"><span class="pill s">S++ / S 核心优先</span><span class="pill a">A 重点投</span><span class="pill b">B 可尝试</span><span class="pill c">C / D 低优先</span></div><span class="muted">仅显示本科可投岗位；硕士/博士及其他硬门槛岗位默认排除</span></div><div class="summary"><b>共 ${list.length} 个岗位</b><span class="muted">按最终推荐等级 → 候选人适配 → 投递优先分排序</span></div><div class="joblist">${list.slice(0,S.limit).map(jobCard).join('')||'<div class="card empty">没有符合当前筛选条件的岗位</div>'}</div>${list.length>S.limit?'<p style="text-align:center"><button class="btn" id="more">加载更多</button></p>':''}${dataNotes()}</section>`
}

function dataNotes(){return`<div class="card help"><h3>评价说明 · V1.2</h3><ul><li><b>AI_Job</b> 只负责发现、抓取、去重、来源核验与JD结构化；最终等级由本看板规则生成。</li><li><b>Eligibility Gate</b>：仅硕士/研究生、博士学历岗位，以及其他本科不满足的硬门槛岗位，直接从主看板排除；本科及以上、本科/硕士均可岗位保留。</li><li><b>Candidate Fit</b> = 职责30 + 专业语言20 + 真实经历25 + 职业方向15 + 可补足能力10。</li><li><b>Data Quality</b> 单独0–10，不进入适配分；INVALID岗位只进入数据修复队列。</li><li><b>风险</b> 单独扣分：长期驻外-15、高频出差-8、强销售KPI-10、高压-5等。</li><li>二手来源不降低候选人适配度，只降低信息可信度；投递前必须回企业官网核验。</li><li><b>V1.2 推荐层</b>：适配等级与最终推荐等级分离；卡片等级表示"最终推荐"。最终推荐按风险后的优先分调整，PARTIAL 岗位推荐上限为 B，明确海外工作地点按长期海外风险 -15 处理；服务海外市场但工作地点在国内不会触发该项。</li><li><b>V1.3 情报层</b>：岗位层展示月薪/年薪、来源与可信度；公司风险按 A 一手材料、B 高可信媒体、C 社区线索、D 未核实传闻分级。CampusShame、牛客、脉脉等社区内容默认只作核验线索，不参与 S/A/B，也不把匿名单帖当事实。</li></ul></div>`}

function syncPanel(){return`<div class="card offer" style="padding:16px;margin-bottom:14px"><div class="ruleline" style="margin:0"><div><b style="font-size:13px;color:#344054">云同步</b><div class="muted" style="font-size:12px;margin-top:2px">${syncStatusText()}</div></div><div class="actions"><input id="sync-secret" type="password" placeholder="同步密码（在 Vercel 项目里设置）" value="${S.sync.secret?esc(S.sync.secret):''}" style="border:1px solid var(--line-strong);border-radius:9px;padding:8px 10px;min-width:200px"><button class="btn" id="sync-save">${S.sync.secret?'更新密码':'启用同步'}</button>${S.sync.secret?'<button class="btn" id="sync-now">立即同步</button>':''}</div></div></div>`}
function pipelinePage(){const all=evaluated(),selected=all.filter(j=>S.status[j.id]);return`<section class="hero"><div><h1>我的投递</h1><div class="subtitle">投递记录保存在当前浏览器；启用云同步后可在多台设备间同步。</div></div></section>${syncPanel()}<div class="toolbar"><div class="actions"><button class="btn" id="export-json">导出 JSON</button><button class="btn" id="export-csv">导出 CSV</button><button class="btn" id="import-json">导入 JSON</button><input id="import-file" type="file" accept="application/json" class="hidden"></div><span class="muted">当前记录 ${selected.length} 个岗位</span></div><div class="pipeline">${STAGES.map(stage=>{const arr=selected.filter(j=>S.status[j.id]===stage);return`<div class="lane"><h3>${stage} · ${arr.length}</h3>${arr.map(j=>`<div class="mini" data-detail="${esc(j.id)}"><b>${esc(j.title)}</b><small>${esc(j.company)} · ${esc(j._evaluation.level)}</small></div>`).join('')||'<span class="muted">暂无</span>'}</div>`}).join('')}</div>${dataNotes()}`}
function bars(rows,max){const m=max||Math.max(1,...rows.map(x=>x[1]));return rows.map(([n,v])=>`<div class="bar"><span>${esc(n)}</span><div class="barbg"><div class="barfill" style="width:${Math.min(100,v/m*100)}%"></div></div><b>${v}</b></div>`).join('')}
function statsPage(){const all=evaluated(),normal=normalJobs();const byDir=Object.entries(normal.reduce((m,j)=>(m[j._evaluation.direction]=(m[j._evaluation.direction]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]).slice(0,8),byCity=Object.entries(normal.reduce((m,j)=>(m[j.city]=(m[j.city]||0)+1,m),{})).sort((a,b)=>b[1]-a[1]).slice(0,8);return`<section class="hero"><div><h1>统计分析</h1><div class="subtitle">把候选人适配、数据质量和来源可信度分开看。</div></div>${updateBox()}</section><div class="charts"><div class="card chart"><h3>推荐等级</h3>${bars(['S++','S','A','B','C','D'].map(x=>[x,normal.filter(j=>j._evaluation.level===x).length]))}</div><div class="card chart"><h3>数据质量</h3>${bars(['VALID','PARTIAL'].map(x=>[x,normal.filter(j=>j._evaluation.dataQuality.status===x).length]))}</div><div class="card chart"><h3>方向分布</h3>${bars(byDir)}</div><div class="card chart"><h3>来源</h3>${bars([['官方',normal.filter(j=>j.sourceType==='official').length],['二手',normal.filter(j=>j.sourceType!=='official').length]])}</div></div>${dataNotes()}`}
function offerScore(o){return Math.round((Number(o.fit||0)*.3+Number(o.growth||0)*.25+Number(o.pay||0)*.2+Number(o.city||0)*.15+Number(o.pace||0)*.1)*10)/10}
function offersPage(){return`<section class="hero"><div><h1>Offer 对比</h1><div class="subtitle">匹配30% · 成长25% · 薪酬20% · 城市15% · 工作节奏10%</div></div></section><div class="offers"><form id="offer-form" class="card offer"><div class="grid"><input class="wide" name="company" required placeholder="公司"><input class="wide" name="title" required placeholder="岗位"><input name="location" placeholder="城市"><input name="salary" placeholder="薪资/总包"><div><label>岗位匹配 1–10</label><input name="fit" type="number" min="1" max="10" value="7"></div><div><label>成长空间 1–10</label><input name="growth" type="number" min="1" max="10" value="7"></div><div><label>薪酬福利 1–10</label><input name="pay" type="number" min="1" max="10" value="7"></div><div><label>城市偏好 1–10</label><input name="city" type="number" min="1" max="10" value="7"></div><div><label>工作节奏 1–10</label><input name="pace" type="number" min="1" max="10" value="7"></div><textarea class="wide" name="note" placeholder="备注"></textarea><button class="btn primary wide">加入对比</button></div></form><div class="card offer table"><table><thead><tr><th>公司 / 岗位</th><th>城市</th><th>薪资</th><th>综合</th><th>备注</th><th></th></tr></thead><tbody>${S.offers.length?[...S.offers].sort((a,b)=>offerScore(b)-offerScore(a)).map(o=>`<tr><td><b>${esc(o.company)}</b><br>${esc(o.title)}</td><td>${esc(o.location||'-')}</td><td>${esc(o.salary||'-')}</td><td><b>${offerScore(o)}</b></td><td>${esc(o.note||'-')}</td><td><button class="btn danger" data-delete-offer="${o.id}">删除</button></td></tr>`).join(''):'<tr><td colspan="6" class="muted">暂无 Offer 对比记录</td></tr>'}</tbody></table></div></div>`}

// ---- modal (now includes salary + company risk sections inline) ----
function detailBox(label,value){return`<div class="detailbox"><b>${esc(label)}</b><span class="muted">${esc(value||'未披露')}</span></div>`}
function riskEventRow(event){
  const link=/^https?:\/\//i.test(String(event?.sourceUrl||''))?`<a class="intel-link" href="${esc(event.sourceUrl)}" target="_blank" rel="noopener">证据</a>`:'';
  return`<div class="detailbox intel-event"><div class="intel-event-head"><b>${esc(event.date||'日期待核')} · ${esc(typeLabel(event.type))}</b><span class="tag ${['A','B'].includes(event.evidenceLevel)?'warn':''}">${esc(event.evidenceLevel)}级 · ${esc(levelLabel(event.evidenceLevel))}</span></div><div class="intel-event-title">${esc(event.title||'历史事件')}</div>${event.summary?`<div class="muted intel-event-summary">${esc(event.summary)}</div>`:''}<div class="muted intel-event-foot">范围：${esc(event.scope||'待核')} · 来源：${esc(event.source||'待核')}${link?` · ${link}`:''}</div></div>`
}
function modal(){if(!S.selected)return'';const j=evaluated().find(x=>x.id===S.selected);if(!j)return'';const v=j._evaluation,p=v.fit.parts,r=v.reasoning;
  const comp=j.compensation||{};
  const events=riskEvents(riskFor(j.company));
  return`<div class="modalbg" data-close="1"><div class="modal" onclick="event.stopPropagation()"><button class="close" data-close="1">×</button><div class="company">${esc(j.company)}</div><h2>${esc(j.title)}</h2><p><span class="pill ${levelClass(v.level)}">${esc(recLabel(v.level))}</span> ${v.gate.passed&&v.dataQuality.status!=='INVALID'?`<b>适配 ${v.fit.score}/100</b> · 风险 -${v.risk.deduction} · 优先 ${v.priorityScore}`:''}</p><div class="detailgrid"><div class="detailbox"><b>职责 ${p.responsibility}/30</b><span class="muted">${esc(r.responsibility)}</span></div><div class="detailbox"><b>专业语言 ${p.majorLanguage}/20</b><span class="muted">${esc(r.major)}</span></div><div class="detailbox"><b>真实经历 ${p.experience}/25</b><span class="muted">${esc(r.experience)}</span></div><div class="detailbox"><b>方向价值 ${p.careerValue}/15</b><span class="muted">${esc(r.career)}</span></div><div class="detailbox"><b>可补足能力 ${p.learnability}/10</b><span class="muted">${esc(r.learnability)}</span></div><div class="detailbox"><b>信息可信度 ${v.dataQuality.score}/10</b><span class="muted">${esc(v.dataQuality.status)}</span></div></div><div class="intel-section"><h3>薪资情报</h3><div class="detailgrid">${detailBox('月薪',j.monthlySalary||comp.monthlyDisplay||'未披露')}${detailBox('年薪',j.annualSalary||comp.annualDisplay||'未披露')}${detailBox('原始薪资',comp.raw||j.salary||'未披露')}${detailBox('薪资来源',comp.sourceLabel||'岗位来源未披露')}${detailBox('薪资可信度',confidenceLabel(comp))}${detailBox('薪资证据',comp.evidence||'来源未披露数字薪资')}</div><p class="intel-note">月薪/年薪只使用来源页或JD明确披露数字；未写薪数时仅按12薪估算，并显式标记。不擅自加入年终奖、股票、补贴或绩效奖金。</p></div><div class="intel-section"><h3>公司往年风险事件 / 实习留用线索</h3>${riskSourceGuide()}${events.length?events.slice(0,5).map(riskEventRow).join(''):'<div class="detailbox muted">暂无满足"时间 + 来源 + 可追溯链接 + 证据等级"要求的已录入事件；这不等于"无风险"，仍需核验具体团队和年份。</div>'}<p class="intel-note">历史事件不等于当前状态；A/B级可作为高可信风险情报，C级社区经验只用于面试反问/核验，D级传闻默认隐藏。公司历史风险不参与本看板 S/A/B 或 Candidate Fit 计算。</p></div><h3>Gate / 风险</h3><div class="tags">${v.gate.reasons.map(x=>`<span class="tag bad">× ${esc(x)}</span>`).join('')}${v.risk.items.map(x=>`<span class="tag warn">${esc(x.label)} -${x.value}</span>`).join('')}${v.gate.passed&&!v.risk.items.length?'<span class="tag ok">硬条件通过 · 无明显风险</span>':''}</div><h3>证据化理由</h3><div class="detailbox"><div>${esc(r.experience)}</div><div class="muted" style="margin-top:6px">${esc(r.dataQuality)}</div></div>${j.sourceUrl?`<p><a class="btn primary" target="_blank" rel="noopener" href="${esc(j.sourceUrl)}">${j.sourceType==='official'?'打开官方职位':'查看来源并回官网核验'}</a></p>`:''}</div></div>`}

function render(){const body=S.tab==='jobs'?jobsPage():S.tab==='pipeline'?pipelinePage():S.tab==='stats'?statsPage():offersPage();app.innerHTML=shell(body)}

// ---- data loading (single fetch of jobs + risk history, run once in parallel) ----
function parseModule(raw){const a=raw.indexOf('export const liveJobs ='),s=raw.indexOf('[',a),m=raw.indexOf('export const discoveryMeta',s),segment=raw.slice(s,m),end=segment.lastIndexOf('];');if(a<0||s<0||m<0||end<0)throw Error('岗位池格式异常');const jobs=JSON.parse(segment.slice(0,end+1));let meta={};const ms=raw.indexOf('{',m),me=raw.lastIndexOf('};');if(ms>0&&me>ms)try{meta=JSON.parse(raw.slice(ms,me+1))}catch{}return{jobs,meta}}
async function fetchText(url){const c=new AbortController(),timer=setTimeout(()=>c.abort(),9000);try{const res=await fetch(url,{cache:'no-store',signal:c.signal});if(!res.ok)throw Error(String(res.status));return await res.text();}finally{clearTimeout(timer)}}
async function loadJobsAndMeta(){for(const url of DATA_URLS){try{const {jobs,meta}=parseModule(await fetchText(url));if(!jobs.length)throw Error('empty');return{jobs,meta,mode:'live'}}catch(err){console.warn('[board data]',err)}}return{jobs:fb,meta:{},mode:'fallback'}}
async function loadRiskSet(source){for(const url of source.urls){let blobUrl='';try{const raw=await fetchText(url);blobUrl=URL.createObjectURL(new Blob([raw],{type:'text/javascript'}));const mod=await import(blobUrl);const rows=mod[source.exportName];return Array.isArray(rows)?rows:[]}catch(e){console.warn(`[risk ${source.exportName}]`,e)}finally{if(blobUrl)URL.revokeObjectURL(blobUrl)}}return[]}
async function loadRiskProfiles(){const groups=await Promise.all(RISK_SOURCES.map(loadRiskSet));return groups.flat()}
async function load(){
  const [{jobs,meta,mode},riskProfiles]=await Promise.all([loadJobsAndMeta(),loadRiskProfiles()]);
  S.jobs=jobs;S.meta=meta;S.mode=mode;S.riskProfiles=riskProfiles;
  S.updated=meta.updatedAt||jobs[0]?.discoveredAt||'';
  render();
  if(S.sync.secret) pullRemote();
}

// ---- backend sync (投递状态/Offer 对比 across devices, was localStorage-only) ----
// Best-effort: if /api/state isn't configured (no Vercel KV connected) or the network fails,
// this silently falls back to local-only, same philosophy as the job-data fallback above.
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
      S.status=remote.status||{};S.offers=remote.offers||[];S.updatedAt=remote.updatedAt||Date.now();
      localStorage.setItem(STORAGE,JSON.stringify({status:S.status,offers:S.offers,updatedAt:S.updatedAt}));
    }else if(S.updatedAt>(remote.updatedAt||0)){
      await syncFetch('POST',{status:S.status,offers:S.offers,updatedAt:S.updatedAt});
    }
    S.sync.state='synced';S.sync.lastSyncedAt=Date.now();
  }catch(err){console.warn('[sync pull]',err);S.sync.state='offline'}
  if(S.tab==='pipeline') render();
}
async function pushRemote(){
  if(!S.sync.secret) return;
  S.sync.state='syncing';
  try{
    await syncFetch('POST',{status:S.status,offers:S.offers,updatedAt:S.updatedAt});
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

app.addEventListener('click',ev=>{
  const tab=ev.target.closest('[data-tab]')?.dataset.tab;if(tab){S.tab=tab;S.selected=null;render();return}
  const detail=ev.target.closest('[data-detail]')?.dataset.detail;if(detail){S.selected=detail;render();return}
  if(ev.target.closest('[data-close]')){S.selected=null;render();return}
  if(ev.target.id==='reset'){S.filter={q:'',level:'全部',direction:'全部',city:'全部',source:'全部',quality:'全部'};render();return}
  if(ev.target.id==='more'){S.limit+=40;render();return}
  const qlevel=ev.target.closest('[data-qlevel]')?.dataset.qlevel;if(qlevel!==undefined){S.filter.level=qlevel;render();return}
  if(ev.target.closest('[data-qofficial]')){S.filter.source=S.filter.source==='官方'?'全部':'官方';render();return}
  if(ev.target.id==='export-json'){download('campus-job-board-applications.json',JSON.stringify({status:S.status,offers:S.offers,exportedAt:new Date().toISOString()},null,2));return}
  if(ev.target.id==='export-csv'){const rows=[['岗位ID','公司','岗位','状态','等级','适配度','优先分','信息质量'],...evaluated().filter(j=>S.status[j.id]).map(j=>[j.id,j.company,j.title,S.status[j.id],j._evaluation.level,j._evaluation.fit.score,j._evaluation.priorityScore,j._evaluation.dataQuality.status])];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');download('campus-job-board-applications.csv',csv,'text/csv;charset=utf-8');return}
  if(ev.target.id==='import-json'){document.getElementById('import-file')?.click();return}
  const del=ev.target.closest('[data-delete-offer]')?.dataset.deleteOffer;if(del){S.offers=S.offers.filter(o=>o.id!==del);save();render()}
  if(ev.target.id==='sync-save'){const v=(document.getElementById('sync-secret')?.value||'').trim();S.sync.secret=v;if(v)localStorage.setItem(SYNC_SECRET_KEY,v);else localStorage.removeItem(SYNC_SECRET_KEY);if(v)pullRemote();else render();return}
  if(ev.target.id==='sync-now'){pullRemote();return}
});
app.addEventListener('input',ev=>{if(ev.target.id==='q'){S.filter.q=ev.target.value;const pos=ev.target.selectionStart;render();const q=document.getElementById('q');q?.focus();q?.setSelectionRange(pos,pos)}});
app.addEventListener('change',ev=>{
  if(['level','direction','city','source','quality'].includes(ev.target.id)){S.filter[ev.target.id]=ev.target.value;render();return}
  const id=ev.target.dataset.status;if(id!==undefined){if(ev.target.value)S.status[id]=ev.target.value;else delete S.status[id];save();render();return}
  if(ev.target.id==='import-file'&&ev.target.files?.[0]){const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);S.status=data.status||{};S.offers=data.offers||[];save();render()}catch{alert('JSON 文件格式不正确')}};reader.readAsText(ev.target.files[0])}
});
app.addEventListener('submit',ev=>{if(ev.target.id!=='offer-form')return;ev.preventDefault();const data=Object.fromEntries(new FormData(ev.target).entries());S.offers.push({id:'offer-'+Date.now(),...data});save();render()});

render();load();
})();
