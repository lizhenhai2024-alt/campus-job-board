(()=>{'use strict';
const root=document.getElementById('app');
if(!root)return;

function text(el){return(el?.textContent||'').trim()}
function parseMetric(card,key){
  const s=text(card.querySelector('.level small'));
  const m=s.match(key==='fit'?/适配\s*(\d+)\/100/:/优先\s*(\d+)/);
  return m?m[1]:'—';
}
function metaParts(card){return[...card.querySelectorAll('.meta span')].map(x=>text(x).replace(/^[📍🧭🗓]\s*/,'').trim())}
function installStyle(){
  if(document.getElementById('decision-ui-v14-style'))return;
  const s=document.createElement('style');s.id='decision-ui-v14-style';s.textContent=`
  .decision-quick{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
  .decision-quick-label{font-size:12px;color:var(--muted);font-weight:700;margin-right:2px}
  .quick-btn{border:1px solid var(--line-strong);background:#fff;color:#556176;border-radius:999px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer;transition:.15s ease}
  .quick-btn:hover{border-color:#b8c3d8;background:#fafbff}.quick-btn.active{background:var(--blue-soft);border-color:var(--blue-line);color:var(--blue)}
  .quick-btn.official.active{background:var(--greenbg);border-color:#cdeee0;color:var(--green)}
  .decision-grid{display:grid;grid-template-columns:1.25fr .85fr .85fr;gap:8px;margin:12px 0 0}
  .decision-cell{background:#f8faff;border:1px solid #e9edf5;border-radius:10px;padding:8px 10px;min-width:0}
  .decision-cell span{display:block;font-size:10px;color:#8b95a7;font-weight:700;letter-spacing:.2px;margin-bottom:1px}
  .decision-cell b{display:block;font-size:13px;color:#2c3b58;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .decision-cell.fit b{color:#3159d8}.decision-cell.priority b{color:#16825d}
  .decision-why{display:flex;gap:8px;align-items:flex-start;margin-top:9px;padding:8px 10px;border-radius:10px;background:#fbfcfe;border:1px solid #edf0f5;color:#647087;font-size:12px}
  .decision-why strong{color:#46536b;white-space:nowrap}.decision-why span{min-width:0}
  .job .tags{margin-top:8px}.job .tags .tag{opacity:.82;font-size:11px}
  .job .tags .tag[data-secondary="1"]{background:#fafbfc;border-color:#edf0f4;color:#8a94a6}
  .job .tags .tag[data-risk="1"]{opacity:1;background:var(--amberbg);border-color:#efdcaf;color:var(--amber)}
  .job .match{min-width:0}.job .match .level{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex-wrap:wrap}
  .job .match .level small{display:block;margin:0}.job .matchreason{display:none}
  .job .actions{justify-content:flex-end}.job .actions .btn.primary{min-width:88px}
  .job .company{display:flex;align-items:center;gap:7px}.job .company:after{content:'公司';font-size:10px;font-weight:650;color:#a1a9b8;border:1px solid #e9ecf2;border-radius:5px;padding:0 4px}
  .summary{padding:0 2px}.summary b{font-size:15px}
  @media(max-width:780px){.decision-grid{grid-template-columns:1fr 1fr}.decision-cell:first-child{grid-column:1/-1}.job .match .level{justify-content:flex-start}.job .actions{justify-content:flex-start}.decision-why{line-height:1.5}}
  @media(max-width:480px){.decision-grid{grid-template-columns:1fr}.decision-cell:first-child{grid-column:auto}.quick-btn{padding:5px 9px}}
  `;document.head.appendChild(s)
}
function markTags(card){
  card.querySelectorAll('.tags .tag').forEach(tag=>{
    const t=text(tag);
    if(/信息\s*\d+\/10|VALID|待核|待修复|官方来源|二手来源/.test(t))tag.dataset.secondary='1';
    if(/风险|长期|出差|高压|KPI|历史风险/.test(t))tag.dataset.risk='1';
  })
}
function decorateCard(card){
  if(!card.dataset.decisionV14){
    const left=card.firstElementChild,meta=card.querySelector('.meta'),tags=card.querySelector('.tags');
    if(!left||!meta||!tags)return;
    const parts=metaParts(card),direction=parts[1]||'方向待核',fit=parseMetric(card,'fit'),priority=parseMetric(card,'priority');
    const grid=document.createElement('div');grid.className='decision-grid';grid.innerHTML=`<div class="decision-cell"><span>岗位方向</span><b>${direction}</b></div><div class="decision-cell fit"><span>候选人适配</span><b>${fit==='—'?'—':fit+' / 100'}</b></div><div class="decision-cell priority"><span>投递优先分</span><b>${priority}</b></div>`;
    tags.insertAdjacentElement('beforebegin',grid);
    const reason=text(card.querySelector('.matchreason'))||'查看评价详情获取完整判断依据';
    const why=document.createElement('div');why.className='decision-why';why.innerHTML=`<strong>推荐判断</strong><span></span>`;why.querySelector('span').textContent=reason;grid.insertAdjacentElement('afterend',why);
    card.dataset.decisionV14='1';
  }
  markTags(card)
}
function setSelect(id,value){const el=root.querySelector(id);if(!el)return;el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}))}
function decorateQuick(){
  const rule=root.querySelector('.ruleline');if(!rule||rule.querySelector('.decision-quick'))return;
  const level=root.querySelector('#level'),source=root.querySelector('#source');if(!level||!source)return;
  const box=document.createElement('div');box.className='decision-quick';box.innerHTML=`<span class="decision-quick-label">快速筛选</span>${['全部','S++','S','A','B'].map(v=>`<button class="quick-btn" data-qlevel="${v}">${v==='全部'?'全部岗位':v}</button>`).join('')}<button class="quick-btn official" data-official="1">只看官方</button>`;
  rule.insertAdjacentElement('afterbegin',box);
  const sync=()=>{
    box.querySelectorAll('[data-qlevel]').forEach(b=>b.classList.toggle('active',b.dataset.qlevel===level.value));
    box.querySelector('[data-official]')?.classList.toggle('active',source.value==='官方');
  };
  box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.qlevel)setSelect('#level',b.dataset.qlevel);else if(b.dataset.official)setSelect('#source',source.value==='官方'?'全部':'官方')});
  sync()
}
function renameSummary(){
  root.querySelectorAll('.summary .muted').forEach(n=>{if(/排序/.test(text(n)))n.textContent='按最终推荐等级 → 候选人适配 → 投递优先分排序'})
}
function decorate(){installStyle();decorateQuick();renameSummary();root.querySelectorAll('.card.job').forEach(decorateCard)}
let queued=false;function schedule(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate()})}
decorate();new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
})();
