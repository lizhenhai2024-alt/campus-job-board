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
 *
 * 看板（index.html / app-core.js / api/ 等）摘除后，本脚本是仓库里唯一还在跑的
 * 校验，也是 campus 这个仓库存在的理由。它现在有两半：
 *   1-4) 契约的规则/上限/后处理 vs scoring.js 的 risk()/patchRisk()  —— 防漂移
 *   5)   契约自身的完整性（风险源 URL、证据等级、正则可编译）        —— 自洽
 * 注意 scoring.js 是**被校验方**，不要为了方便去改它的规则实现。
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

// ---- 5) 风险源与证据等级：契约自校验 ----
//
// 这一段原先对照 app-core.js 里的 RISK_SOURCES / validRiskEvent 常量。看板摘除后
// 那份常量随之删除（它只服务于看板 UI），本段改成校验契约自身的完整性——
// 契约现在是这些字段的唯一载体，下游（CareerPilot）直接照着它取 URL 和白名单，
// 所以它必须是自洽的，且不能出现"两边都没有"的空档。
const KNOWN_EXPORTS = new Set(['companyRiskHistory', 'priorityCompanyRiskHistory']);
const sources = contract.riskSources.sources;
check(sources.length >= 2, `风险源应至少声明 2 个，实际 ${sources.length}`);
for (const src of sources) {
  check(KNOWN_EXPORTS.has(src.exportName),
    `风险源 exportName 不是已知的上游导出：${src.exportName}`);
  check(Array.isArray(src.urls) && src.urls.length > 0,
    `风险源 ${src.exportName} 没有声明任何 URL`);
  for (const url of src.urls || []) {
    check(/^https:\/\//.test(String(url)),
      `风险源 ${src.exportName} 的 URL 必须是 https：${url}`);
  }
}

const ev = contract.riskEventRules;
const levels = Object.keys(ev.evidenceLevels);
check(levels.join('') === 'ABCD', `证据等级应为 ABCD，实际 ${levels.join('')}`);
for (const [level, meta] of Object.entries(ev.evidenceLevels)) {
  check(typeof meta.display === 'boolean', `证据等级 ${level} 缺 display 布尔值`);
  check(typeof meta.highTrust === 'boolean', `证据等级 ${level} 缺 highTrust 布尔值`);
}
// "未经核实传闻默认隐藏" 是对下游的明确承诺，不能悄悄改成展示。
check(ev.evidenceLevels.D.display === false, 'D 级必须 display:false（默认隐藏）');
for (const level of ev.highRiskLevels || []) {
  check(levels.includes(level), `highRiskLevels 里的 ${level} 不在证据等级中`);
}
check(Array.isArray(ev.requiredFields) && ev.requiredFields.length > 0,
  'riskEventRules.requiredFields 不能为空');
check(Array.isArray(ev.typeDomain) && ev.typeDomain.length > 0,
  'riskEventRules.typeDomain 不能为空');
// 下游会用这两个正则判定事件合法性；编译不过就等于契约不可用。
for (const key of ['dateFormat', 'sourceUrlFormat']) {
  try {
    new RegExp(ev[key]);
  } catch (e) {
    check(false, `riskEventRules.${key} 不是合法正则：${e.message}`);
  }
}

// ---- 输出 ----
if (failures.length) {
  console.error('[risk-contract] FAIL：risk-intelligence.json 与 scoring.js 不一致');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`[risk-contract] OK 规则 ${specRules.length} 条与 scoring.js 一致，风险源 ${contract.riskSources.sources.length} 个，证据等级 ${levels.join('/')}`);
