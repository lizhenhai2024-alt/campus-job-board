/**
 * 从 AI_Job 实时岗位池生成收窄后的投递清单。
 * 用法: node scripts/build-shortlist.cjs <AI_Job/src/data/live-jobs.js> [输出.md]
 * 收窄逻辑见 docs/投递清单_2027届_收窄版.md 文末「收窄规则」。
 */
const fs = require('fs');
const path = require('path');

const LIVE = process.argv[2] || '../AI_Job/src/data/live-jobs.js';
const OUT = process.argv[3] || 'docs/投递清单_2027届_收窄版.md';

const INDUSTRY = {
  智能硬件出海: ['拓竹科技','安克创新','传音控股','图拉斯','影石Insta360','正浩创新EcoFlow','追觅科技','普渡机器人','杭州宇树科技股份有限公司','优必选科技','未岚大陆','扬腾创新','荣耀','OPPO','vivo','小米','海信','创维集团','深圳市康冠科技股份有限公司','华勤技术','格兰仕','奥马冰箱','奥克斯','奥克斯集团','得力集团','洲明科技','锐捷网络','中兴通讯','拓邦股份','京东方','锐明技术','新华三集团','万兴科技','深圳菲亚兰德科技集团股份有限公司','致欧家居'],
  '汽车/新能源出海': ['蔚来','小鹏汽车','吉利汽车','零跑汽车','岚图汽车','宁德时代新能源科技股份有限公司','德赛西威','惠州市德赛西威汽车电子股份有限公司','福耀玻璃','赛轮轮胎','三一集团','万向集团','星源材质','金发科技','中信科移动'],
  品牌方跨境: ['SHEIN','名创优品','泡泡玛特','Babycare','水羊集团御泥坊','顾家家居','蜜雪冰城','英科医疗/英科再生','傲基科技'],
  外企: ['Decathlon','宝洁','达能','雀巢中国','优衣库','NVIDIA 英伟达'],
  央国企国际业务: ['厦门象屿','国贸股份','北京四达时代国际投资有限公司'],
};
const CAP = { 智能硬件出海:4, '汽车/新能源出海':4, 品牌方跨境:4, 外企:3, 央国企国际业务:3 };

const OVERSEAS = /海外|国际|出海|跨境|全球|GTM|go[- ]?to[- ]?market|overseas|global|外贸|欧美|东南亚|中东|非洲|拉美|北美|欧洲|本地化运营/i;
const TITLE_OV = /海外|国际|跨境|全球|GTM|外贸|亚马逊|Amazon|TikTok|独立站|欧美|中东|非洲|美洲|MakerWorld|UMC|迅销/i;
const FUNC = /市场|营销|品牌|运营|GTM|产品|项目|供应链|采购|物流|商务|贸易|管培|培训生|未来星|储备|marketing/i;
// 与英专长期路径不符：英语不是生产资料，或积累不可携带
const EXCLUDE = /翻译|笔译|口译|本地化专员|跟单|行政|文员|前台|客服|销售代表|渠道销售|门店|导购|店长|人力|HR|招聘|薪酬|财务|会计|审计|税务|法务|合规|工程师|研发|算法|架构|测试|运维|开发|设计师|UI|美术|保险|理财|客户经理|精算|核保|理赔|教师|助教|课程顾问|讲师|数据分析师|风控|投资|证券|技术管培|光伏|EHS|安全|生产制造|采购执行|供应链交付|服务解决方案|线下渠道/;
const TRAINEE = /管培|管理培训|培训生|未来星|储备|trainee|计划生/i;
// 纯出海企业：国内岗位也带英语场景
const PURE_EXPORT = /拓竹科技|图拉斯|安克创新|致欧家居|傲基科技|SHEIN|正浩创新|影石|传音控股|扬腾创新|Babycare|万兴科技/;
const FIT_FLOOR = 65;
const PENDING = '待归类:';

function parseArrayLiteral(file, varName) {
  const src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf('[', src.indexOf('export const ' + varName));
  let depth = 0, i = start, inStr = false, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === '[') depth++; else if (c === ']') { depth--; if (!depth) { i++; break; } }
  }
  return JSON.parse(src.slice(start, i));
}

// 公司库兜底：白名单是手工维护的，岗位池新进公司不在名单里会被静默剔除。
// 读 AI_Job 的 company-library.js，有行业标签的标为「待归类」单独列出，人工决定是否并入白名单。
const LIB = path.resolve(path.dirname(LIVE), 'company-library.js');
const companyLibrary = fs.existsSync(LIB) ? parseArrayLiteral(LIB, 'companyLibrary') : [];

function industryOf(company) {
  for (const [name, list] of Object.entries(INDUSTRY)) if (list.includes(company)) return name;
  const lib = companyLibrary.find(c => c.name === company);
  if (lib && lib.industries && lib.industries.length) return PENDING + lib.industries[0];
  return null;
}

function build(jobs, S, now = new Date()) {
  const rows = [];
  for (const j of jobs) {
    const e = S.evaluate(j, now);
    if (!e.gate.passed || e.dataQuality.status === 'INVALID') continue;
    const industry = industryOf(j.company);
    if (!industry) continue;
    const title = String(j.title || '');
    if (EXCLUDE.test(title)) continue;
    const blob = [title, j.jobDescription, j.jobRequirements, j.description, (j.roleFamily || []).join(' ')].filter(Boolean).join(' ');
    if (!FUNC.test(blob) || !OVERSEAS.test(blob)) continue;
    if (!TITLE_OV.test(title) && !PURE_EXPORT.test(j.company)) continue;
    if (e.fit.score < FIT_FLOOR) continue;
    rows.push({
      industry, company: j.company, title, city: j.city || '待核', url: j.sourceUrl,
      trainee: TRAINEE.test(blob), fit: e.fit.score,
      risk: e.risk.items.map(x => x.label).filter(x => !/高压|城市非目标/.test(x)),
    });
  }
  // 同一实体公司+岗位去重，每家公司限额
  const norm = c => c.replace(/惠州市|股份有限公司|有限公司|集团|杭州|科技股份/g, '');
  const seen = new Set(), per = {}, out = [];
  rows.sort((a, b) => b.fit - a.fit);
  for (const r of rows) {
    const key = norm(r.company) + '|' + r.title.replace(/[（(].*$/, '').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    per[r.company] = (per[r.company] || 0) + 1;
    if (per[r.company] > (CAP[r.industry] || 3)) continue;
    r.tier = r.industry.startsWith(PENDING) ? '待归类'
           : (r.fit >= 80 && (r.trainee || /GTM|海外市场|海外营销|产品营销|海外运营/.test(r.title))) ? '冲刺'
           : r.fit >= 72 ? '主力' : '保底';
    out.push(r);
  }
  const order = { 冲刺: 1, 主力: 2, 保底: 3, 待归类: 4 };
  out.sort((a, b) => order[a.tier] - order[b.tier] || b.fit - a.fit);
  return out;
}

function render(rows, total) {
  const g = {};
  rows.forEach(r => (g[r.tier] = g[r.tier] || []).push(r));
  const note = {
    冲刺: '**投递方式：必须逐份定制**，每份针对JD改3–5处关键词。',
    主力: '**投递方式：模板+微调**，按「海外市场 / 跨境运营 / 国际供应链」三类各做一版简历。',
    保底: '**投递方式：直接投**，不投入定制时间。',
    待归类: '公司不在行业白名单里，但 AI_Job 公司库有行业标签，职能与海外信号均已通过筛选。**人工判断后决定是否并入白名单**（改 `scripts/build-shortlist.cjs` 的 `INDUSTRY`）。',
  };
  let s = `# 2027届投递清单（收窄版）\n\n> 自动生成于 ${new Date().toISOString().slice(0, 10)}，由 \`scripts/build-shortlist.cjs\` 从 AI_Job 实时岗位池（${total} 条）收窄到 ${rows.length} 条。\n> 每条均已通过 V1.2 硬门槛（本科可投、2027届、无小语种/理工硬门槛、未截止）。\n> fit 仅供排序参考，不作为取舍依据。\n\n---\n\n`;
  for (const t of ['冲刺', '主力', '保底', '待归类']) {
    if (!g[t]) continue;
    s += `## ${t}（${g[t].length}）\n\n${note[t]}\n\n| 公司 | 岗位 | 城市 | 行业归属 | 通道 | 提示 |\n|---|---|---|---|---|---|\n`;
    g[t].forEach(r => {
      const link = r.url ? `[${r.title.replace(/\|/g, '')}](${r.url})` : r.title.replace(/\|/g, '');
      s += `| ${r.company} | ${link} | ${r.city} | ${r.industry} | ${r.trainee ? '管培生' : '—'} | ${r.risk.length ? '⚠ ' + r.risk.join('、') : ''} |\n`;
    });
    s += '\n';
  }
  return s;
}

const jobs = parseArrayLiteral(LIVE, 'liveJobs');
global.window = global;
require(path.resolve(__dirname, '../scoring.js'));
const rows = build(jobs, globalThis.CampusScoring);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const existing = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
const rulesIdx = existing.indexOf('## 收窄规则');
const rules = rulesIdx >= 0 ? '---\n\n' + existing.slice(rulesIdx) : '';
fs.writeFileSync(OUT, render(rows, jobs.length) + rules);
console.log(`岗位池 ${jobs.length} → 清单 ${rows.length} 条，已写入 ${OUT}`);
