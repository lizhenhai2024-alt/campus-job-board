(()=>{'use strict';
const root=document.getElementById('app');
if(!root)return;

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
    li.innerHTML='<b>V1.2 推荐层</b>：适配等级与最终推荐等级分离；最终推荐按风险后的优先分调整，PARTIAL 岗位推荐上限为 B，明确海外工作地点按长期海外风险 -15 处理。';
    ul.appendChild(li);
  });

  root.querySelectorAll('.job').forEach(card=>{
    const level=card.querySelector('.level small');
    if(level&&level.textContent.includes('适配')&&!level.textContent.includes('推荐')){
      const pill=card.querySelector('.level .pill');
      if(pill) pill.title='最终推荐等级（V1.2）';
    }
  });
}

patchText();
new MutationObserver(()=>patchText()).observe(root,{childList:true,subtree:true});
})();
