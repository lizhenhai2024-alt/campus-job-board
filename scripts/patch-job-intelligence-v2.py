#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch(rel, replacements):
    p = ROOT / rel
    text = p.read_text(encoding='utf-8')
    original = text
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'{rel}: expected fragment not found:\n{old[:260]}')
        text = text.replace(old, new, 1)
    if text == original:
        raise SystemExit(f'{rel}: no changes')
    p.write_text(text, encoding='utf-8')
    print('patched', rel)


patch('app-core.js', [
    (
        "function salaryText(job){const m=job?.monthlySalary||job?.compensation?.monthlyDisplay||'',a=job?.annualSalary||job?.compensation?.annualDisplay||'';if(!job?.compensation?.disclosed)return'';return [m,a].filter(Boolean).join(' · ')}",
        "function salaryText(job){const m=job?.monthlySalary||job?.compensation?.monthlyDisplay||'',a=job?.annualSalary||job?.compensation?.annualDisplay||'';if(!job?.compensation?.disclosed)return'';return [m,a].filter(Boolean).join(' · ')}\nfunction publishedText(job){const v=String(job?.publishedAt||'');return /^\\d{4}-\\d{2}-\\d{2}$/.test(v)?v:''}\nfunction headcountText(job){const h=job?.headcount||{};if(!h.disclosed)return'';const d=h.display||job?.headcountDisplay||'';if(!d)return'';return h.scope==='program'?`校招规模 ${d}`:`HC ${d}`}\nfunction headcountTitle(job){const h=job?.headcount||{};if(!h.disclosed)return'';const scope=h.scope==='program'?'整届/项目招聘规模，不等于本岗位HC':'本岗位招聘HC';return [scope,h.sourceLabel||'',h.evidence||''].filter(Boolean).join('；')}"
    ),
    (
        "const comp=j.compensation||{},salary=salaryText(j);\n  const events=riskEvents(riskFor(j.company));",
        "const comp=j.compensation||{},salary=salaryText(j),published=publishedText(j),hc=headcountText(j);\n  const events=riskEvents(riskFor(j.company));"
    ),
    (
        "${salary?`<span class=\"tag pay\" title=\"薪资来源：${esc(comp.sourceLabel||'岗位来源')}；可信度：${esc(confidenceLabel(comp))}\"><svg width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"6\" width=\"20\" height=\"12\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><line x1=\"6\" y1=\"10\" x2=\"6\" y2=\"10\"/></svg>${esc(salary)}</span>`:''}\n        <span class=\"tag ${j.sourceType==='official'?'ok':'warn'}\">",
        "${published?`<span class=\"tag\" title=\"来源披露的岗位发布日期；系统发现时间不作为发布日期\">发布 ${esc(published)}</span>`:''}\n        ${hc?`<span class=\"tag\" title=\"${esc(headcountTitle(j))}\">${esc(hc)}</span>`:''}\n        ${salary?`<span class=\"tag pay\" title=\"薪资来源：${esc(comp.sourceLabel||'岗位来源')}；可信度：${esc(confidenceLabel(comp))}\"><svg width=\"11\" height=\"11\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"6\" width=\"20\" height=\"12\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/><line x1=\"6\" y1=\"10\" x2=\"6\" y2=\"10\"/></svg>${esc(salary)}</span>`:''}\n        <span class=\"tag ${j.sourceType==='official'?'ok':'warn'}\">"
    ),
    (
        "function companyJobRow(j, applyUsed=0){\n  const v=j._evaluation;",
        "function companyJobRow(j, applyUsed=0){\n  const v=j._evaluation;\n  const salary=salaryText(j),published=publishedText(j),hc=headcountText(j);"
    ),
    (
        "<div class=\"co-job-sub\">${esc(j.city||'待核')} · ${esc(v.direction)} · ${esc(j.deadline||'待核')}</div>",
        "<div class=\"co-job-sub\">${esc(j.city||'待核')} · ${esc(v.direction)} · 截止 ${esc(j.deadline||'待核')}${published?` · 发布 ${esc(published)}`:''}${hc?` · ${esc(hc)}`:''}${salary?` · ${esc(salary)}`:''}</div>"
    ),
    (
        "${hcData?`<div class=\"co-hc-salary\" style=\"font-size:12px;color:#666;margin-top:4px;line-height:1.5\"><span style=\"color:#2e7d32;font-weight:600\">HC:</span> ${esc(hcData.hc)} &nbsp;|&nbsp; <span style=\"color:#1565c0;font-weight:600\">薪资:</span> ${esc(hcData.salary)}${hcData.note?` <span style=\"color:#999\" title=\"${esc(hcData.note)}\">ⓘ</span>`:''}</div>`:''}",
        "${hcData?`<div class=\"co-hc-salary\" style=\"font-size:12px;color:#666;margin-top:4px;line-height:1.5\" title=\"公司级参考，不代表具体岗位；来源：${esc(hcData.source||'待核')}\"><span style=\"color:#2e7d32;font-weight:600\">校招规模参考:</span> ${esc(hcData.hc)} &nbsp;|&nbsp; <span style=\"color:#1565c0;font-weight:600\">市场薪资参考:</span> ${esc(hcData.salary)}${hcData.note?` <span style=\"color:#999\" title=\"${esc(hcData.note)}\">ⓘ</span>`:''}</div>`:''}"
    )
])

patch('company-hc-salary.js', [
    (
        "// 公司HC与薪资参考数据（2027届校招）\n// 数据来源：各公司校招官网、高校就业网、牛客/职友集真实offer分享\n// 注意：薪资为市场/运营/GTM方向参考区间，研发岗通常更高\n// 更新时间：2026-09-12\nwindow.COMPANY_HC_SALARY = {",
        "// 公司级校招规模与市场薪资参考（非岗位事实源）\n// 数据来源：公司校招官网、高校就业网、公开媒体与可追溯 offer/招聘信息。\n// 强制口径：hc 是公司/整届/项目层面的规模参考，不得当成本岗位 HC；salary 是市场参考，不得覆盖 AI_Job 中岗位 JD/ATS 明确披露的 compensation。\n// 岗位级发布日期、HC、薪资事实统一以 AI_Job live-jobs 的 publishedAt / headcount / compensation 为准。\n// 更新时间：2026-09-12\nwindow.COMPANY_HC_SALARY_META={scope:'company_reference',jobFactSource:'AI_Job/live-jobs',updatedAt:'2026-09-12'};\nwindow.COMPANY_HC_SALARY = {"
    )
])

patch('audit-intelligence-v1.3.cjs', [
    (
        "const COVERAGE_TARGETS = { riskCompanies: 0.50, salaryJobs: 0.50 };",
        "const COVERAGE_TARGETS = { riskCompanies: 0.50, salaryJobs: 0.50, headcountJobs: 0.20, publicationJobs: 0.50 };"
    ),
    (
        "name: job.company || '待核公司', jobs: 0, salaryKnown: 0, officialJobs: 0,",
        "name: job.company || '待核公司', jobs: 0, salaryKnown: 0, headcountKnown: 0, publicationKnown: 0, officialJobs: 0,"
    ),
    (
        "c.salaryKnown += job.compensation?.disclosed ? 1 : 0;\n    c.officialJobs += job.sourceType === 'official' ? 1 : 0;",
        "c.salaryKnown += job.compensation?.disclosed ? 1 : 0;\n    c.headcountKnown += job.headcount?.disclosed ? 1 : 0;\n    c.publicationKnown += /^\\d{4}-\\d{2}-\\d{2}$/.test(String(job.publishedAt || '')) ? 1 : 0;\n    c.officialJobs += job.sourceType === 'official' ? 1 : 0;"
    ),
    (
        "const salaryKnownJobs = priorityJobs.filter(({ job }) => job.compensation?.disclosed).length;\n  const riskCoveredCompanies",
        "const salaryKnownJobs = priorityJobs.filter(({ job }) => job.compensation?.disclosed).length;\n  const headcountKnownJobs = priorityJobs.filter(({ job }) => job.headcount?.disclosed).length;\n  const publicationKnownJobs = priorityJobs.filter(({ job }) => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(job.publishedAt || ''))).length;\n  const riskCoveredCompanies"
    ),
    (
        "console.log(`salaryKnownJobs=${salaryKnownJobs}/${priorityJobs.length} (${pct(salaryKnownJobs, priorityJobs.length)})`);\n  console.log(`salaryCoveredCompanies=${salaryCoveredCompanies}/${companyRows.length} (${pct(salaryCoveredCompanies, companyRows.length)})`);",
        "console.log(`salaryKnownJobs=${salaryKnownJobs}/${priorityJobs.length} (${pct(salaryKnownJobs, priorityJobs.length)})`);\n  console.log(`headcountKnownJobs=${headcountKnownJobs}/${priorityJobs.length} (${pct(headcountKnownJobs, priorityJobs.length)})`);\n  console.log(`publicationKnownJobs=${publicationKnownJobs}/${priorityJobs.length} (${pct(publicationKnownJobs, priorityJobs.length)})`);\n  console.log(`salaryCoveredCompanies=${salaryCoveredCompanies}/${companyRows.length} (${pct(salaryCoveredCompanies, companyRows.length)})`);"
    ),
    (
        "console.log(`coverageTarget: riskCompanies>=50% (gap ${targetGap(riskCoveredCompanies, companyRows.length, COVERAGE_TARGETS.riskCompanies)} companies); salaryJobs>=50% (gap ${targetGap(salaryKnownJobs, priorityJobs.length, COVERAGE_TARGETS.salaryJobs)} jobs)`);",
        "console.log(`coverageTarget: riskCompanies>=50% (gap ${targetGap(riskCoveredCompanies, companyRows.length, COVERAGE_TARGETS.riskCompanies)} companies); salaryJobs>=50% (gap ${targetGap(salaryKnownJobs, priorityJobs.length, COVERAGE_TARGETS.salaryJobs)} jobs); headcountJobs>=20% (gap ${targetGap(headcountKnownJobs, priorityJobs.length, COVERAGE_TARGETS.headcountJobs)} jobs); publicationJobs>=50% (gap ${targetGap(publicationKnownJobs, priorityJobs.length, COVERAGE_TARGETS.publicationJobs)} jobs)`);"
    ),
    (
        "console.log('\\n--- PRIORITY JOBS MISSING SALARY ---');",
        "console.log('\\n--- PRIORITY JOBS MISSING HC ---');\n  const missingHc = priorityJobs.filter(({ job }) => !job.headcount?.disclosed).slice(0, 40);\n  if (!missingHc.length) console.log('none');\n  for (const { job, e, level } of missingHc) console.log(`${level}\\tP${e.priorityScore}\\t${job.company}\\t${job.title}\\t${job.city || '待核'}\\t${job.sourceType || 'unknown'}`);\n\n  console.log('\\n--- PRIORITY JOBS MISSING PUBLICATION DATE ---');\n  const missingPublication = priorityJobs.filter(({ job }) => !/^\\d{4}-\\d{2}-\\d{2}$/.test(String(job.publishedAt || ''))).slice(0, 40);\n  if (!missingPublication.length) console.log('none');\n  for (const { job, e, level } of missingPublication) console.log(`${level}\\tP${e.priorityScore}\\t${job.company}\\t${job.title}\\t${job.city || '待核'}\\t${job.sourceType || 'unknown'}`);\n\n  console.log('\\n--- PRIORITY JOBS MISSING SALARY ---');"
    ),
    (
        "console.log('\\nNOTE: “missing risk intelligence” means no evidence-backed event is recorded; it does NOT mean the company is risk-free. Coverage targets are research goals only and never change S/A/B or fail CI.');",
        "console.log('\\nNOTE: missing risk/HC/salary/publication means the current evidence pool has no supported fact; it does NOT mean risk-free, HC=0, salary=0, or that the job is old. Coverage targets are research goals only and never change S/A/B or fail CI.');"
    )
])

# Replace intelligence rules doc with V1.4 wording while keeping filename for compatibility.
doc = ROOT / '情报层规则_岗位薪资与公司风险_V1.3.md'
doc.write_text('''# 2027届校招机会看板 · 情报层规则 V1.4\n\n> 适用系统：`campus-job-board`\n>\n> 岗位事实源：`AI_Job`\n>\n> 原则：发布日期、岗位 HC、岗位薪资与公司历史事件用于补充投递决策信息，不替代 Candidate Fit；缺失字段不猜测，不把公司规模或传闻伪装成岗位事实。\n\n## 1. 岗位发布日期\n\n- 只接受公司官网 / ATS / 可追溯来源明确披露的 `publishedAt / datePosted / PostDate` 等发布日期。\n- `discoveredAt / first_seen / 抓取时间` 只代表系统发现时间，禁止冒充岗位发布日期。\n- 来源没有日期时显示“未公布/待核”，不根据网页更新时间或首次抓取时间推断。\n\n## 2. 岗位 HC\n\nAI_Job 输出结构化 `headcount`：`disclosed / min / max / scope / display / sourceLabel / confidence / evidence`。\n\n- `scope=job`：明确为本岗位/本职位招聘人数，可显示为 `HC 3人`。\n- `scope=program`：整届校招、全国校招、项目招聘规模，只能显示为 `校招规模 1000人`，不得当成本岗位 HC。\n- 公司员工总人数、业务规模、岗位数量、招聘网站职位数均不得推断 HC。\n- HC 未披露时保持空/未披露，严禁把“岗位仍开放”推断为“HC充足”。\n\n## 3. 岗位薪资情报\n\n每个岗位允许包含月薪、年薪、原始薪资文本、来源、可信度、证据摘录、估算标记和明确薪数。\n\n- `high`：企业官方 JD / ATS 明确披露。\n- `medium`：可追溯二手岗位来源，必须标记“待官网复核”。\n- 未披露数字薪资时不猜测。\n- `15K-25K·14薪` 可按 14 薪计算年薪；只写月薪时仅按 12 薪估算并标记；只写年薪时月薪只能做 12 个月等效估算。\n- 不擅自加入未披露年终奖、股票、补贴或绩效。\n\n## 4. 公司级 HC / 薪资参考\n\n`company-hc-salary.js` 只保留**公司/整届校招规模参考 + 市场薪资参考**，不是岗位事实源。\n\n- 公司级参考不得覆盖 AI_Job 中该岗位的 `headcount / compensation`。\n- UI 必须使用“校招规模参考 / 市场薪资参考”字样，禁止简称为“HC / 薪资”造成岗位级误解。\n- 来源与年份必须可见；过期参考只能作为背景信息。\n\n## 5. 公司往年风险事件\n\n重点覆盖：实习转正/留用/HC 风险、裁员/优化、校招毁约/缩招、工作强度争议、薪资倒挂/调薪争议、组织重组。\n\n任何事件必须至少包含 `id / type / date / title / source / sourceUrl / evidenceLevel`。缺少日期、来源、可追溯链接或证据等级的事件不进入事实展示。\n\n证据等级：A=公司/监管/法院等一手材料；B=权威媒体或公司回应；C=可追溯社区经验，只作线索；D=未经核实传闻，默认隐藏。\n\n## 6. 展示规则\n\n岗位卡片优先展示 AI_Job 的：`发布日 + HC/校招规模 + 薪资`。缺失就不造数。公司级参考单独展示并明确“参考”。\n\n公司历史事件逐条显示时间、类型、影响范围、来源和证据等级；C 级必须明确为社区经验线索。\n\n## 7. 与 S/A/B 的关系\n\nCandidate Fit / S/A/B 仍按职责、专业语言、真实经历、职业方向和可补足能力计算。Job Risk 仍按当前岗位驻外、出差、销售 KPI、高压等偏好风险计算。岗位 HC、薪资、发布日期和公司历史事件是独立情报层，不自动改变 Candidate Fit；C/D 绝不直接改变 S/A/B。\n\n最终投递决策由：`Eligibility + 岗位适配 + Capability + Career Fit + 当前岗位风险 + 发布/HC/薪资事实 + 公司历史情报 + 个人偏好` 综合判断。\n''', encoding='utf-8')
print('patched 情报层规则_岗位薪资与公司风险_V1.3.md')
