(()=>{'use strict';
const LIVE_URLS=['https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/live-jobs.js','https://cdn.jsdelivr.net/gh/lizhenhai2024-alt/AI_Job@main/src/data/live-jobs.js'];
const RISK_URLS=['https://raw.githubusercontent.com/lizhenhai2024-alt/AI_Job/main/src/data/company-risk-history.js','https://cdn.jsdelivr.net/gh/lizhenhai2024-alt/AI_Job@main/src/data/company-risk-history.js'];
let jobs=[],riskProfiles=[],ready=false,scheduled=false;
const jobById=new Map();

function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function companyKey(v=''){return String(v).replace(/[（(].*?[）)]/g,'').replace(/股份有限公司|集团有限公司|有限公司|集团|控股|中国/gi,'').replace(/[\s·,.，、_-]/g,'').toLowerCase();}
function sameCompany(a,b){const x=companyKey(a),y=companyKey(b);return Boolean(x&&y&&(x===y||x.includes(y)||y.includes(x)));}
function parseJobs(raw){const a=raw.indexOf('export const liveJobs ='),s=raw.indexOf('[',a),m=raw.indexOf('export const discoveryMeta',s),segment=raw.slice(s,m),end=segment.lastIndexOf('];');if(a<0||s<0||m<0||end<0)throw Error('岗位池格式异常');return JSON.parse(segment.slice(0,end+1));}
async function fetchText(url){const c=new AbortController(),timer=setTimeout(()=>c.abort(),9000);try{const res=await fetch(url,{cache:'no-store',signal:c.signal});if(!res.ok)throw Error(String(res.status));return await res.text();}finally{clearTimeout(timer)}}
async function loadJobs(){for(const url of LIVE_URLS){try{return parseJobs(await fetchText(url))}catch(e){console.warn('[intelligence jobs]',e)}}return[]}
async function loadRisk(){for(const url of RISK_URLS){let blobUrl='';try{const raw=await fetchText(url);blobUrl=URL.createObjectURL(new Blob([raw],{type:'text/javascript'}));const mod=await import(blobUrl);return Array.isArray(mod.companyRiskHistory)?mod.companyRiskHistory:[]}catch(e){console.warn('[intelligence risk]',e)}finally{if(blobUrl)URL.revokeObjectURL(blobUrl)}}return[]}
function riskFor(company){return riskProfiles.find(p=>sameCompany(p.company,company)||(p.aliases||[]).some(a=>sameCompany(a,company)))||null}
function typeLabel(type){return({layoff:'裁员/人员优化',restructuring:'组织重组',intern_conversion:'实习转正/留用',offer_change:'校招毁约/缩招',work_intensity:'工作强度争议',compensation:'薪酬争议'})[type]||'历史事件'}
function levelLabel(level){return({A:'一手材料',B:'高可信媒体/公司回应',C:'社区经验线索',D:'未经核实传闻'})[level]||'证据待核'}
function jobForCard(card){const id=card.querySelector('[data-detail]')?.dataset.detail;return jobById.get(String(id||''))||null}
function salaryText(job){const m=job?.monthlySalary||job?.compensation?.monthlyDisplay||'',a=job?.annualSalary||job?.compensation?.annualDisplay||'';if(!job?.compensation?.disclosed)return'';return [m,a].filter(Boolean).join(' · ')}
function create(tag,cls='',text=''){const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n}
function sourceLink(event){if(!/^https?:\/\//i.test(String(event?.sourceUrl||'')))return null;const a=create('a','intel-link','证据');a.href=event.sourceUrl;a.target='_blank';a.rel='noopener';return a}
function riskEvents(profile){return(profile?.events||[]).filter(e=>e.evidenceLevel!=='D').sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))}

function decorateCard(card){if(card.dataset.intelV13==='1')return;const job=jobForCard(card);if(!job)return;const tags=card.querySelector('.tags');if(!tags)return;
 const salary=salaryText(job);if(salary){const t=create('span','tag ok',`💰 ${salary}`);t.title=job.compensation?.sourceLabel||'薪资来源';tags.append(t)}
 const events=riskEvents(riskFor(job.company));if(events.length){const high=events.filter(e=>['A','B'].includes(e.evidenceLevel)&&e.sentiment==='negative').length,intern=events.filter(e=>e.type==='intern_conversion').length;if(high)tags.append(create('span','tag warn',`历史风险 ${high}`));if(intern)tags.append(create('span','tag',`实习留用线索 ${intern}`));}
 card.dataset.intelV13='1';}

function modalJob(modal){const company=modal.querySelector('.company')?.textContent?.trim()||'',title=modal.querySelector('h2')?.textContent?.trim()||'';return jobs.find(j=>sameCompany(j.company,company)&&String(j.title||'').trim()===title)||null}
function detailBox(label,value){const box=create('div','detailbox');const b=create('b','',label),span=create('span','muted',value||'未披露');box.append(b,span);return box}
function decorateModal(modal){if(modal.dataset.intelV13==='1')return;const job=modalJob(modal);if(!job)return;const anchor=modal.querySelector('h3');const salarySection=create('div','intel-section');salarySection.append(create('h3','','薪资情报'));const grid=create('div','detailgrid');const comp=job.compensation||{};grid.append(detailBox('月薪',job.monthlySalary||comp.monthlyDisplay||'未披露'),detailBox('年薪',job.annualSalary||comp.annualDisplay||'未披露'),detailBox('原始薪资',comp.raw||job.salary||'未披露'),detailBox('薪资口径',comp.disclosed?`${comp.sourceLabel||'岗位来源'}；${comp.annualEstimated?'年薪含推算标记':'采用来源披露值'}`:'来源未披露数字薪资'));salarySection.append(grid);salarySection.append(create('p','intel-note','未写薪数时只按12薪估算；不擅自加入年终奖、股票、补贴或绩效奖金。'));
 const riskSection=create('div','intel-section');riskSection.append(create('h3','','公司历史风险 / 实习留用线索'));const events=riskEvents(riskFor(job.company));if(!events.length){riskSection.append(create('div','detailbox muted','暂无已录入的高可信公开风险事件；这不等于“无风险”，仍需核验具体团队和年份。'))}else{for(const event of events.slice(0,5)){const row=create('div','detailbox intel-event');const head=create('div','intel-event-head');head.append(create('b','',`${event.date||'日期待核'} · ${typeLabel(event.type)}`),create('span',`tag ${['A','B'].includes(event.evidenceLevel)?'warn':''}`,`${event.evidenceLevel}级 · ${levelLabel(event.evidenceLevel)}`));row.append(head,create('div','intel-event-title',event.title||'历史事件'));if(event.summary)row.append(create('div','muted intel-event-summary',event.summary));const foot=create('div','muted intel-event-foot',`范围：${event.scope||'待核'} · 来源：${event.source||'待核'}`);const link=sourceLink(event);if(link){foot.append(document.createTextNode(' · '),link)}row.append(foot);riskSection.append(row)}}
 riskSection.append(create('p','intel-note','历史事件不等于当前状态；C级社区经验仅用于面试反问/核验，不参与本看板 S/A/B 或适配度计算。'));
 if(anchor){anchor.insertAdjacentElement('beforebegin',riskSection);riskSection.insertAdjacentElement('beforebegin',salarySection)}else{modal.append(salarySection,riskSection)}modal.dataset.intelV13='1';}

function installStyle(){if(document.getElementById('intel-v13-style'))return;const s=document.createElement('style');s.id='intel-v13-style';s.textContent='.intel-section{margin-top:14px}.intel-note{font-size:12px;color:var(--muted);margin:6px 0 10px}.intel-event{margin:7px 0}.intel-event-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.intel-event-title{font-weight:700;margin-top:5px}.intel-event-summary{margin-top:4px;line-height:1.55}.intel-event-foot{font-size:12px;margin-top:5px}.intel-link{color:var(--blue);text-decoration:none}.intel-link:hover{text-decoration:underline}';document.head.append(s)}
function decorate(){if(!ready)return;installStyle();document.querySelectorAll('.card.job').forEach(decorateCard);const modal=document.querySelector('.modal');if(modal)decorateModal(modal)}
function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;decorate()})}
async function init(){const [j,r]=await Promise.all([loadJobs(),loadRisk()]);jobs=j;riskProfiles=r;jobById.clear();for(const job of jobs)jobById.set(String(job.id),job);ready=true;decorate()}
const root=document.getElementById('app');if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});init();
})();
