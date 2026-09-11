const fs = require('node:fs');
require('./scoring.js');
const S = globalThis.CampusScoring;

const path = process.argv[2] || 'AI_Job/src/data/live-jobs.js';
const raw = fs.readFileSync(path,'utf8');
function parseJobs(raw){
  const a=raw.search(/export\s+const\s+liveJobs\s*=/);
  const s=raw.indexOf('[',a);
  const m=raw.search(/export\s+const\s+discoveryMeta/);
  const segment=raw.slice(s,m<0?raw.length:m);
  const end=segment.lastIndexOf(']');
  if(a<0||s<0||end<0) throw new Error('cannot parse liveJobs');
  return JSON.parse(segment.slice(0,end+1));
}
const jobs=parseJobs(raw);
const now=new Date('2026-09-10T00:00:00+08:00');
const rows=jobs.map(j=>({job:j,result:S.evaluate(j,now)}));
const countBy=(fn)=>rows.reduce((m,x)=>{const k=fn(x);m[k]=(m[k]||0)+1;return m},{});
const sortObj=o=>Object.fromEntries(Object.entries(o).sort((a,b)=>b[1]-a[1]));
const levels=sortObj(countBy(x=>x.result.level));
const quality=sortObj(countBy(x=>x.result.dataQuality.status));
const gateReasons={};
for(const x of rows) for(const r of x.result.gate.reasons) gateReasons[r]=(gateReasons[r]||0)+1;
const dirs=sortObj(countBy(x=>x.result.direction));
const high=rows.filter(x=>['S++','S'].includes(x.result.level)).sort((a,b)=>b.result.priorityScore-a.result.priorityScore);
const gateFail=rows.filter(x=>!x.result.gate.passed);
const invalid=rows.filter(x=>x.result.dataQuality.status==='INVALID');
const partial=rows.filter(x=>x.result.dataQuality.status==='PARTIAL');
const suspiciousHigh=high.filter(x=>/跟单|客服|销售代表|行政|文员|翻译专员|实施|工程师/i.test(x.job.title||''));
const secondaryHigh=high.filter(x=>x.job.sourceType!=='official');
const longOverseas=rows.filter(x=>x.result.risk.items.some(r=>/长期驻外/.test(r)));
const explicitWrongYear=rows.filter(x=>S.explicitNon2027Title&&S.explicitNon2027Title(x.job.title));

console.log('\n=== CAMPUS JOB BOARD V1.1 FULL-POOL CALIBRATION ===');
console.log('jobs:',jobs.length);
console.log('levels:',JSON.stringify(levels));
console.log('dataQuality:',JSON.stringify(quality));
console.log('directions:',JSON.stringify(dirs));
console.log('gateFail:',gateFail.length,'gateReasons:',JSON.stringify(sortObj(gateReasons)));
console.log('high(S++/S):',high.length,`(${(high.length/jobs.length*100).toFixed(1)}%)`);
console.log('secondaryHigh:',secondaryHigh.length,'suspiciousHigh:',suspiciousHigh.length,'longOverseas:',longOverseas.length,'explicitWrongYear:',explicitWrongYear.length);

function line(x){
  const j=x.job,r=x.result,p=r.fit.parts;
  return `${r.level}\tP${r.priorityScore}\tFit${r.fit.score}[R${p.responsibility}/M${p.majorLanguage}/E${p.experience}/C${p.careerValue}/L${p.learnability}]\tQ${r.dataQuality.score}/${r.dataQuality.status}\tRisk-${r.risk.deduction}\t${j.company}\t${j.title}\t${j.city||'-'}\t${r.direction}\t${j.sourceType||'-'}\t${r.gate.reasons.join('|')||'-'}`;
}
console.log('\n--- TOP 30 ---');
high.slice(0,30).forEach(x=>console.log(line(x)));
console.log('\n--- BENCHMARK ROLES ---');
const benchmarkRx=/GTM|Go-to-Market|项目管理|PMO|产品营销|产品经理|海外业务|国际业务|跨境电商|供应链|HRBP|人力资源|销售跟单|商务管培|品牌市场|产品运营/i;
rows.filter(x=>benchmarkRx.test(`${x.job.company} ${x.job.title}`)).sort((a,b)=>b.result.priorityScore-a.result.priorityScore).slice(0,60).forEach(x=>console.log(line(x)));
console.log('\n--- GATE FAIL SAMPLE 20 ---');
gateFail.slice(0,20).forEach(x=>console.log(line(x)));
console.log('\n--- EXPLICIT NON-2027 TITLES ---');
explicitWrongYear.slice(0,30).forEach(x=>console.log(line(x)));
console.log('\n--- INVALID SAMPLE 20 ---');
invalid.slice(0,20).forEach(x=>console.log(line(x)));
console.log('\n--- PARTIAL SAMPLE 20 ---');
partial.slice(0,20).forEach(x=>console.log(line(x)));
console.log('\n--- SECONDARY HIGH SAMPLE 20 ---');
secondaryHigh.slice(0,20).forEach(x=>console.log(line(x)));
console.log('\n--- SUSPICIOUS HIGH ---');
suspiciousHigh.slice(0,30).forEach(x=>console.log(line(x)));

const report={
  generatedAt:new Date().toISOString(), jobs:jobs.length, levels, quality, dirs,
  gateFail:gateFail.length, gateReasons:sortObj(gateReasons), high:high.length,
  secondaryHigh:secondaryHigh.length, suspiciousHigh:suspiciousHigh.length, explicitWrongYear:explicitWrongYear.length,
  top30:high.slice(0,30).map(x=>({company:x.job.company,title:x.job.title,city:x.job.city,sourceType:x.job.sourceType,...x.result})),
  invalidSample:invalid.slice(0,30).map(x=>({company:x.job.company,title:x.job.title,sourceType:x.job.sourceType,...x.result}))
};
fs.writeFileSync('calibration-report-v1.1.json',JSON.stringify(report,null,2));

if(rows.some(x=>x.result.gate.passed===false && ['S++','S','A','B','C','D'].includes(x.result.level))) throw new Error('Gate-failed job entered normal levels');
if(rows.some(x=>x.result.dataQuality.status==='INVALID' && x.result.level!=='数据待修复' && x.result.gate.passed)) throw new Error('INVALID data entered normal levels');
if(explicitWrongYear.some(x=>x.result.gate.passed)) throw new Error('Explicit non-2027 title passed Gate');
if(suspiciousHigh.length>0){
  console.error('WARNING: suspicious high-level jobs found; inspect list above.');
  process.exitCode=2;
}
