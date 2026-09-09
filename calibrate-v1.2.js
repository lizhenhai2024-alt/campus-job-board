const fs=require('node:fs');
require('./scoring-v1.1.js');
require('./scoring-v1.1-language-patch.js');
require('./scoring-v1.2-calibration-patch.js');
const S=globalThis.CampusScoring;

const path=process.argv[2]||'AI_Job/src/data/live-jobs.js';
const raw=fs.readFileSync(path,'utf8');
function parseJobs(raw){
  const a=raw.indexOf('export const liveJobs ='),s=raw.indexOf('[',a),m=raw.indexOf('export const discoveryMeta',s);
  const seg=raw.slice(s,m<0?raw.length:m),end=seg.lastIndexOf('];');
  if(a<0||s<0||end<0) throw new Error('cannot parse liveJobs');
  return JSON.parse(seg.slice(0,end+1));
}
const jobs=parseJobs(raw),now=new Date('2026-09-10T00:00:00+08:00');
const rows=jobs.map(job=>({job,result:S.evaluate(job,now)}));
const sortObj=o=>Object.fromEntries(Object.entries(o).sort((a,b)=>b[1]-a[1]));
const countBy=fn=>sortObj(rows.reduce((m,x)=>{const k=fn(x);m[k]=(m[k]||0)+1;return m},{}));
const levels=countBy(x=>x.result.level),fitLevels=countBy(x=>x.result.fitLevel),quality=countBy(x=>x.result.dataQuality.status),dirs=countBy(x=>x.result.direction);
const gateReasons={};for(const x of rows)for(const r of x.result.gate.reasons)gateReasons[r]=(gateReasons[r]||0)+1;
const normal=rows.filter(x=>x.result.gate.passed&&x.result.dataQuality.status!=='INVALID');
const high=normal.filter(x=>['S++','S'].includes(x.result.level)).sort((a,b)=>b.result.priorityScore-a.result.priorityScore);
const foreign=rows.filter(x=>S.foreignWorkLocation(x.job));
const weirdDeadline=rows.filter(x=>S.implausibleDeadline(x.job.deadline));
const partial=rows.filter(x=>x.result.dataQuality.status==='PARTIAL');
const invalid=rows.filter(x=>x.result.dataQuality.status==='INVALID');
const suspiciousHigh=high.filter(x=>/跟单|客服|销售代表|行政|文员|翻译专员|实施|工程师/i.test(x.job.title||''));
const benchmarkRx=/GTM|Go-to-Market|项目管理|PMO|产品营销|产品经理|海外业务|国际业务|跨境电商|供应链|HRBP|人力资源|品牌市场|产品运营/i;
const benchmark=normal.filter(x=>benchmarkRx.test(`${x.job.company} ${x.job.title}`)).sort((a,b)=>b.result.priorityScore-a.result.priorityScore).slice(0,80);

function line(x){
  const j=x.job,r=x.result,p=r.fit.parts;
  return `${r.level}\tFitLv${r.fitLevel}\tP${r.priorityScore}\tFit${r.fit.score}[R${p.responsibility}/M${p.majorLanguage}/E${p.experience}/C${p.careerValue}/L${p.learnability}]\tQ${r.dataQuality.score}/${r.dataQuality.status}\tRisk-${r.risk.deduction}\t${j.company}\t${j.title}\t${j.city||'-'}\t${r.direction}\t${j.sourceType||'-'}\t${r.gate.reasons.join('|')||'-'}`;
}
console.log('\n=== CAMPUS JOB BOARD V1.2 FULL-POOL CALIBRATION ===');
console.log('jobs:',jobs.length);
console.log('recommendationLevels:',JSON.stringify(levels));
console.log('fitLevels:',JSON.stringify(fitLevels));
console.log('dataQuality:',JSON.stringify(quality));
console.log('directions:',JSON.stringify(dirs));
console.log('gateFail:',rows.filter(x=>!x.result.gate.passed).length,'gateReasons:',JSON.stringify(sortObj(gateReasons)));
console.log('foreignWorkLocations:',foreign.length,'implausibleDeadlines:',weirdDeadline.length,'partial:',partial.length,'invalid:',invalid.length,'high:',high.length);

console.log('\n--- TOP RECOMMENDATIONS ---');high.slice(0,30).forEach(x=>console.log(line(x)));
console.log('\n--- BENCHMARK A/B CALIBRATION ---');benchmark.forEach(x=>console.log(line(x)));
console.log('\n--- FOREIGN WORK LOCATIONS ---');foreign.slice(0,40).sort((a,b)=>b.result.fit.score-a.result.fit.score).forEach(x=>console.log(line(x)));
console.log('\n--- IMPLAUSIBLE DEADLINES ---');weirdDeadline.slice(0,30).forEach(x=>console.log(line(x)));
console.log('\n--- PARTIAL SAMPLE ---');partial.slice(0,30).forEach(x=>console.log(line(x)));

const rank={'S++':6,S:5,A:4,B:3,C:2,D:1,'不符合硬条件':0,'数据待修复':-1};
if(rows.some(x=>x.result.gate.passed===false&&['S++','S','A','B','C','D'].includes(x.result.level)))throw new Error('Gate-failed role entered recommendation levels');
if(rows.some(x=>x.result.dataQuality.status==='INVALID'&&x.result.gate.passed&&x.result.level!=='数据待修复'))throw new Error('INVALID role entered recommendation levels');
if(partial.some(x=>(rank[x.result.level]||0)>rank.B))throw new Error('PARTIAL recommendation exceeded B');
if(foreign.some(x=>x.result.gate.passed&&!x.result.risk.items.some(i=>/长期海外工作地点|长期派驻|长期驻外/.test(i.label)&&i.value>=15)))throw new Error('Foreign work location missing -15 overseas risk');
if(weirdDeadline.some(x=>x.result.dataQuality.status==='VALID'))throw new Error('Implausible deadline remained VALID');
if(normal.some(x=>(rank[x.result.level]||0)>(rank[x.result.fitLevel]||0)))throw new Error('Recommendation level exceeded fit level');
if(suspiciousHigh.length)throw new Error('Suspicious S/S++ role detected');

fs.writeFileSync('calibration-report-v1.2.json',JSON.stringify({generatedAt:new Date().toISOString(),jobs:jobs.length,levels,fitLevels,quality,dirs,gateReasons:sortObj(gateReasons),foreign:foreign.length,weirdDeadline:weirdDeadline.length,partial:partial.length,invalid:invalid.length,top:high.slice(0,30).map(x=>({company:x.job.company,title:x.job.title,city:x.job.city,...x.result}))},null,2));
