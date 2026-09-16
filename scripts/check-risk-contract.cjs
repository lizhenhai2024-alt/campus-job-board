#!/usr/bin/env node
/**
 * 断言 risk-intelligence.json 与 scoring.js 的实际规则一致。
 *
 * 为什么需要：risk-intelligence.json 是对下游（CareerPilot）的对外契约，
 * 而 scoring.js 是内部实现。两者一旦漂移，下游会按过期规则打分且**不会报错**——
 * 这正是本次改造要消灭的问题（原先下游手抄了一套 Python 正则，谁也不知道它过时了）。
 *
 * 断言的是"规则集合一致"，不是"实现方式一致"：只要 scoring.js 的
 * add('label',n)、分句条件、patchRisk 分支与契约对得上就算通过。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const contract = JSON.parse(fs.readFileSync(path.join(root, 'risk-intelligence.json'), 'utf8'));
const scoring = fs.readFileSync(path.join(root, 'scoring.js'), 'utf8');

const squash = (s) => String(s).replace(/\s+/g, '');
const flat = squash(scoring);
const failures = [];
const check = (cond, message) => { if (!cond) failures.push(message); };

const riskBody = (scoring.match(/function risk\(job\)\{[\s\S]*?\n  \}/) || [''])[0];
const patchBody = (scoring.match(/function patchRisk\(base,job\)\{[\s\S]*?\n  \}/) || [''])[0];
check(riskBody, '找不到 scoring.js 的 risk() —— 契约断言的锚点失效了，需要同步更新本脚本');
check(patchBody, '找不到 scoring.js 的 patchRisk()');

// ---- 1) 基础规则：标签与扣分逐条对齐，双向 ----
const specRules = contract.jobRiskRules.rules;
const specByLabel = new Map(specRules.map((r) => [r.label, r]));
const codePairs = [...riskBody.matchAll(/add\('([^']+)',(\d+)\)/g)]
  .map((m) => ({ label: m[1], deduction: Number(m[2]) }));
const codeByLabel = new Map(codePairs.map((r) => [r.label, r]));

for (const rule of specRules) {
  if (rule.scope === 'city') continue; // 城市项是 add 调用，但下面按标签比对
  const inCode = codeByLabel.get(rule.label);
  check(inCode, `契约里的规则「${rule.label}」在 scoring.js 的 risk() 里找不到`);
  if (inCode) {
    check(inCode.deduction === rule.deduction,
      `「${rule.label}」扣分不一致：契约 ${rule.deduction}，scoring.js ${inCode.deduction}`);
  }
}
for (const pair of codePairs) {
  check(specByLabel.has(pair.label),
    `scoring.js 里有规则「${pair.label}」但契约里没有 —— 改规则必须同步改 risk-intelligence.json`);
}

// ---- 2) 正则逐字存在于 scoring.js ----
const collectPatterns = (rule) => [
  ...(rule.match || []).map((m) => ({ where: `${rule.label}.match`, pattern: m.pattern })),
  ...(rule.exclude || []).map((m) => ({ where: `${rule.label}.exclude`, pattern: m.pattern }))
];
for (const rule of specRules) {
  for (const { where, pattern } of collectPatterns(rule)) {
    check(flat.includes(squash(pattern)),
      `${where} 的正则与 scoring.js 对不上（契约侧：${pattern.slice(0, 50)}…）`);
  }
}

// ---- 3) 扣分上限 ----
const cap = contract.jobRiskRules.deductionCap;
check(squash(riskBody).includes(`Math.min(${cap},deduction)`),
  `deductionCap=${cap} 与 scoring.js 的 risk() 不一致`);

// ---- 4) patchRisk（海外工作地点的后处理）----
const post = contract.riskPostAdjustments;
for (const label of post.removeLabels) {
  check(patchBody.includes(`label==='${label}'`),
    `patchRisk 里找不到要移除的标签「${label}」`);
}
check(patchBody.includes(`'${post.add.label}'`) && squash(patchBody).includes(`value:${post.add.deduction}`),
  `patchRisk 里的追加项与契约不一致（契约：${post.add.label} -${post.add.deduction}）`);
for (const { pattern } of post.addUnlessLabelMatches) {
  check(flat.includes(squash(pattern)),
    `patchRisk 的「已存在海外标签则不追加」判据与契约对不上`);
}
for (const { pattern } of post.foreignWorkLocation.cityMatch) {
  check(flat.includes(squash(pattern)), '契约的 foreignWorkLocation.cityMatch 与 scoring.js 对不上');
}
for (const { pattern } of post.foreignWorkLocation.titleMatch) {
  check(flat.includes(squash(pattern)), '契约的 foreignWorkLocation.titleMatch 与 scoring.js 对不上');
}

// ---- 5) 风险源与证据等级 ----
const sourcesBody = (scoring.match(/const RISK_SOURCES=\[[\s\S]*?\];/) || [''])[0];
const coreSrc = fs.existsSync(path.join(root, 'app-core.js'))
  ? (fs.readFileSync(path.join(root, 'app-core.js'), 'utf8').match(/const RISK_SOURCES=\[[\s\S]*?\];/) || [''])[0]
  : '';
const sourceText = sourcesBody || coreSrc;
check(sourceText, '找不到 RISK_SOURCES 声明（scoring.js / app-core.js 都没有）');
for (const src of contract.riskSources.sources) {
  for (const url of src.urls) {
    check(sourceText.includes(url),
      `风险源 ${src.exportName} 的 URL 不在 RISK_SOURCES 里：${url}`);
    check(flat.includes(squash(url)) || sourceText.includes(url),
      `风险源 URL 未在代码中出现：${url}`);
  }
}
const levels = Object.keys(contract.riskEventRules.evidenceLevels);
check(levels.join('') === 'ABCD', `证据等级应为 ABCD，实际 ${levels.join('')}`);
// 按行匹配：函数体里含 /^\d{4}-\d{2}-\d{2}$/ 这类正则字面量，
// 用 [\s\S]*?\} 会被其中的 {4} 提前截断。validRiskEvent 是一行定义的。
const validEventBody = (scoring.match(/function validRiskEvent[^\n]*/) || [''])[0]
  || (fs.existsSync(path.join(root, 'app-core.js'))
    ? (fs.readFileSync(path.join(root, 'app-core.js'), 'utf8').match(/function validRiskEvent[^\n]*/) || [''])[0]
    : '');
check(validEventBody.includes("'A','B','C','D'"),
  'validRiskEvent 的等级白名单与契约的 ABCD 不一致');

// ---- 输出 ----
if (failures.length) {
  console.error('[risk-contract] FAIL：risk-intelligence.json 与 scoring.js 不一致');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`[risk-contract] OK 规则 ${specRules.length} 条与 scoring.js 一致，风险源 ${contract.riskSources.sources.length} 个，证据等级 ${levels.join('/')}`);
