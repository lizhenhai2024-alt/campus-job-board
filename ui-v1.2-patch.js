(()=>{'use strict';
const root=document.getElementById('app');
if(!root)return;

const NORMAL_LEVELS=new Set(['S++','S','A','B','C','D']);

function markRecommendationPill(pill){
  if(!pill||pill.dataset.v12Rec)return;
  const raw=pill.textContent.trim();
  if(!NORMAL_LEVELS.has(raw))return;
  pill.dataset.v12Rec='1';
  pill.dataset.rawLevel=raw;
  pill.textContent=`推荐 ${raw}`;
  pill.title='最终推荐等级（Candidate Fit 经风险与信息可信度调整后）';
}

function patchText(){
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  let n;
  while((n=walker.nextNode())){
    if(n.nodeValue.includes('评价规则 V1.1')) n.nodeValue=n.nodeValue.replaceAll('评价规则 V1.1','评价规则 V1.2');
    if(n.nodeValue.includes('评价说明 · V1.1')) n.nodeValue=n.nodeValue.replaceAll('评价说明 · V1.1','评价说明 · V1.2');
  }

  root.querySelectorAll('.card.help ul').forEach(ul=>{
    if(ul.querySelector('[data-v12-note]'))return;
    const li=document.createElement('li');
    li.dataset.v12Note='1';
    li.innerHTML='<b>V1.2 推荐层</b>：适配等级与最终推荐等级分离；卡片等级表示“最终推荐”。最终推荐按风险后的优先分调整，PARTIAL 岗位推荐上限为 B，明确海外工作地点按长期海外风险 -15 处理；服务海外市场但工作地点在国内不会触发该项。';
    ul.appendChild(li);
  });

  root.querySelectorAll('.job .level .pill, .modal p .pill').forEach(markRecommendationPill);
}

patchText();
new MutationObserver(()=>patchText()).observe(root,{childList:true,subtree:true});
})();
