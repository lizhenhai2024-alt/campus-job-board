#!/usr/bin/env node
'use strict';
// 回归审计：语言硬门槛 / 纯翻译降分 / 海外地点 / 多语种优势
// 用法：node audit-regression.cjs [AI_Job 仓库路径，默认 AI_Job]
// 失败时 exit 1，供 board-check.yml 接入。
const path = require('node:path');
const { pathToFileURL } = require('node:url');

require('./scoring.js');
const S = globalThis.CampusScoring;
if (!S?.evaluate) throw new Error('CampusScoring not loaded');

(async () => {
  const aiRoot = path.resolve(process.argv[2] || 'AI_Job');
  const liveMod = await import(`${pathToFileURL(path.join(aiRoot, 'src/data/live-jobs.js')).href}?t=${Date.now()}`);
  const jobs = Array.isArray(liveMod.liveJobs) ? liveMod.liveJobs : [];
  const NOW = new Date();
  if (!jobs.length) throw new Error('live-jobs.js 为空');

  const failures = [];
  const skipped = [];
  const byTitle = (t) => jobs.find((j) => j.title && j.title.includes(t));
  const byCompanyTitle = (c, t) => jobs.find((j) => j.company && j.company.includes(c) && j.title === t);
  function check(name, job, test, detail) {
    if (!job) { console.log(`SKIP\t${name}\t（当前池无此岗位）`); skipped.push(name); return; }
    const e = S.evaluate(job, NOW);
    const ok = Boolean(test(e));
    console.log(`${ok ? 'PASS' : 'FAIL'}\t${name}${ok ? '' : '\t' + detail(e)}`);
    if (!ok) failures.push(name);
  }

  // 1) 漏杀修复：携程「AI机器人运营-阿拉伯语」必须 Gate Fail
  check('携程 阿拉伯语岗 Gate Fail', byTitle('AI机器人运营（客服智能化方向）- 阿拉伯语'),
    (e) => !e.gate.passed, (e) => JSON.stringify(e.gate.reasons));

  // 2) 误放修复：小米「本地化项目经理」fit < 65
  check('小米 本地化项目经理 fit<65', byCompanyTitle('小米', '本地化项目经理'),
    (e) => e.fit.score < 65, (e) => `fit=${e.fit.score} resp=${e.fit.parts.responsibility} level=${e.recommendationLevel}`);

  // 3) 标题硬限定语言必须排除（样本：小米 电商运营专员-西语）
  check('小米 电商运营专员-西语 Gate Fail', byTitle('电商运营专员-西语'),
    (e) => !e.gate.passed, (e) => JSON.stringify(e.gate.reasons));

  // 4) 多语种优势/小语种非硬门槛：不得误杀
  for (const t of ['用户体验运营（多语种优势', '商家运营（多语种优势', '国际体验运营-小语种']) {
    check(`多语种优势放行 ${t.slice(0, 10)}`, byTitle(t),
      (e) => e.gate.passed, (e) => JSON.stringify(e.gate.reasons));
  }

  // 5) 海外工作地点：安克 GTM PM - Germany → 语言不排除，但触发 -15
  check('安克 GTM PM - Germany 语言不排除', byCompanyTitle('安克创新', 'GTM Product Manager - Germany'),
    (e) => e.gate.passed, (e) => JSON.stringify(e.gate.reasons));
  check('安克 GTM PM - Germany 海外-15', byCompanyTitle('安克创新', 'GTM Product Manager - Germany'),
    (e) => e.risk.items.some((i) => i.label === '长期海外工作地点'), (e) => JSON.stringify(e.risk.items));

  // 6) 业务市场不等于工作地点：泰国市场（上海）不得扣海外 -15
  check('泰国市场(上海) 不扣海外-15', byTitle('泰国市场'),
    (e) => !e.risk.items.some((i) => i.label === '长期海外工作地点'), (e) => JSON.stringify(e.risk.items));

  console.log(`\n总计: ${jobs.length} 岗位；失败 ${failures.length}，跳过 ${skipped.length}`);
  if (failures.length) {
    console.error('REGRESSION FAILED: ' + failures.join('; '));
    process.exit(1);
  }
  console.log('ALL REGRESSION CHECKS PASSED');
})();
