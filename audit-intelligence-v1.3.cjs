#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');

require('./scoring-v1.1.js');
require('./scoring-v1.1-language-patch.js');
require('./scoring-v1.2-calibration-patch.js');

const S = globalThis.CampusScoring;
if (!S?.evaluate) throw new Error('CampusScoring V1.2 not loaded');

const LEVEL_RANK = { 'S++': 6, S: 5, A: 4, B: 3, C: 2, D: 1 };
const PRIORITY = new Set(['S++', 'S', 'A', 'B']);
const COVERAGE_TARGETS = { riskCompanies: 0.50, salaryJobs: 0.50 };

function companyKey(value = '') {
  return String(value)
    .replace(/[（(].*?[）)]/g, '')
    .replace(/股份有限公司|集团有限公司|有限公司|集团|控股|中国/gi, '')
    .replace(/[\s·,.，、_-]/g, '')
    .toLowerCase();
}

function sameCompany(a, b) {
  const x = companyKey(a);
  const y = companyKey(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}

function profileFor(company, profiles) {
  return profiles.find((p) =>
    sameCompany(p.company, company) || (p.aliases || []).some((a) => sameCompany(a, company))
  ) || null;
}

function pct(n, d) {
  return d ? `${Math.round((n / d) * 100)}%` : '0%';
}

function targetGap(current, total, target) {
  if (!total) return 0;
  return Math.max(0, Math.ceil(total * target) - current);
}

(async () => {
  const aiRoot = path.resolve(process.argv[2] || 'AI_Job');
  const liveMod = await import(`${pathToFileURL(path.join(aiRoot, 'src/data/live-jobs.js')).href}?t=${Date.now()}`);
  const riskMod = await import(`${pathToFileURL(path.join(aiRoot, 'src/data/company-risk-history.js')).href}?t=${Date.now()}`);
  const jobs = Array.isArray(liveMod.liveJobs) ? liveMod.liveJobs : [];
  const profiles = Array.isArray(riskMod.companyRiskHistory) ? riskMod.companyRiskHistory : [];
  const now = new Date();

  const evaluated = jobs.map((job) => {
    const e = S.evaluate(job, now);
    return { job, e, level: e.recommendationLevel || e.level };
  });
  const priorityJobs = evaluated.filter(({ e, level }) => e.gate?.passed && e.dataQuality?.status !== 'INVALID' && PRIORITY.has(level));

  const companies = new Map();
  for (const row of priorityJobs) {
    const { job, e, level } = row;
    const key = companyKey(job.company) || String(job.company || '待核公司');
    if (!companies.has(key)) companies.set(key, {
      name: job.company || '待核公司', jobs: 0, salaryKnown: 0, officialJobs: 0,
      bestLevel: level, bestScore: Number(e.priorityScore || 0), levels: new Set()
    });
    const c = companies.get(key);
    c.jobs += 1;
    c.salaryKnown += job.compensation?.disclosed ? 1 : 0;
    c.officialJobs += job.sourceType === 'official' ? 1 : 0;
    c.levels.add(level);
    if ((LEVEL_RANK[level] || 0) > (LEVEL_RANK[c.bestLevel] || 0) ||
        ((LEVEL_RANK[level] || 0) === (LEVEL_RANK[c.bestLevel] || 0) && Number(e.priorityScore || 0) > c.bestScore)) {
      c.bestLevel = level;
      c.bestScore = Number(e.priorityScore || 0);
    }
  }

  const companyRows = [...companies.values()].map((c) => {
    const profile = profileFor(c.name, profiles);
    const events = (profile?.events || []).filter((x) => x.evidenceLevel !== 'D');
    return {
      ...c,
      levels: [...c.levels].sort((a, b) => (LEVEL_RANK[b] || 0) - (LEVEL_RANK[a] || 0)),
      profile,
      events,
      highConfidenceEvents: events.filter((x) => ['A', 'B'].includes(x.evidenceLevel)).length,
      communityEvents: events.filter((x) => x.evidenceLevel === 'C').length
    };
  }).sort((a, b) =>
    (LEVEL_RANK[b.bestLevel] || 0) - (LEVEL_RANK[a.bestLevel] || 0) ||
    b.bestScore - a.bestScore || b.jobs - a.jobs || a.name.localeCompare(b.name, 'zh-CN')
  );

  const salaryKnownJobs = priorityJobs.filter(({ job }) => job.compensation?.disclosed).length;
  const riskCoveredCompanies = companyRows.filter((c) => c.events.length > 0).length;
  const highConfidenceCovered = companyRows.filter((c) => c.highConfidenceEvents > 0).length;
  const salaryCoveredCompanies = companyRows.filter((c) => c.salaryKnown > 0).length;

  console.log('\n=== S/A/B INTELLIGENCE COVERAGE AUDIT V1.3 ===');
  console.log(`liveJobs=${jobs.length}`);
  console.log(`priorityJobs(S++/S/A/B)=${priorityJobs.length}`);
  console.log(`priorityCompanies=${companyRows.length}`);
  console.log(`salaryKnownJobs=${salaryKnownJobs}/${priorityJobs.length} (${pct(salaryKnownJobs, priorityJobs.length)})`);
  console.log(`salaryCoveredCompanies=${salaryCoveredCompanies}/${companyRows.length} (${pct(salaryCoveredCompanies, companyRows.length)})`);
  console.log(`riskCoveredCompanies=${riskCoveredCompanies}/${companyRows.length} (${pct(riskCoveredCompanies, companyRows.length)})`);
  console.log(`AorB-evidence-riskCompanies=${highConfidenceCovered}/${companyRows.length} (${pct(highConfidenceCovered, companyRows.length)})`);
  console.log(`coverageTarget: riskCompanies>=50% (gap ${targetGap(riskCoveredCompanies, companyRows.length, COVERAGE_TARGETS.riskCompanies)} companies); salaryJobs>=50% (gap ${targetGap(salaryKnownJobs, priorityJobs.length, COVERAGE_TARGETS.salaryJobs)} jobs)`);

  console.log('\n--- PRIORITY COMPANIES MISSING RISK INTELLIGENCE ---');
  const missingRisk = companyRows.filter((c) => c.events.length === 0).slice(0, 30);
  if (!missingRisk.length) console.log('none');
  for (const c of missingRisk) {
    console.log(`${c.bestLevel}\tP${c.bestScore}\tjobs=${c.jobs}\tsalary=${c.salaryKnown}/${c.jobs}\tofficial=${c.officialJobs}/${c.jobs}\t${c.name}`);
  }

  console.log('\n--- PRIORITY COMPANIES WITH ONLY COMMUNITY (C) RISK EVIDENCE ---');
  const communityOnly = companyRows.filter((c) => c.events.length > 0 && c.highConfidenceEvents === 0).slice(0, 30);
  if (!communityOnly.length) console.log('none');
  for (const c of communityOnly) {
    console.log(`${c.bestLevel}\tP${c.bestScore}\tC-events=${c.communityEvents}\t${c.name}`);
  }

  console.log('\n--- PRIORITY JOBS MISSING SALARY ---');
  const missingSalary = priorityJobs
    .filter(({ job }) => !job.compensation?.disclosed)
    .sort((a, b) => (LEVEL_RANK[b.level] || 0) - (LEVEL_RANK[a.level] || 0) || Number(b.e.priorityScore || 0) - Number(a.e.priorityScore || 0))
    .slice(0, 40);
  if (!missingSalary.length) console.log('none');
  for (const { job, e, level } of missingSalary) {
    console.log(`${level}\tP${e.priorityScore}\t${job.company}\t${job.title}\t${job.city || '待核'}\t${job.sourceType || 'unknown'}`);
  }

  console.log('\nNOTE: “missing risk intelligence” means no evidence-backed event is recorded; it does NOT mean the company is risk-free. Coverage targets are research goals only and never change S/A/B or fail CI.');
})();
