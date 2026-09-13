# campus-job-board · 2027届校招机会看板

![CI](https://github.com/lizhenhai2024-alt/campus-job-board/actions/workflows/board-check.yml/badge.svg) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

面向 **2027 届校招**的岗位适配度评价看板，为候选人（湖南大学英语本科）提供岗位的资格判断、适配评分、风险调整与投递推荐排序。

> 数据职责分工：`AI_Job` 负责岗位发现、官网/ATS 抓取、去重、JD 结构化和来源核验；本仓库独立负责最终资格判断、适配评价、风险调整和推荐排序。

## 核心模型

主看板基础评分仍是 **V1.2**。Career Fit V1.2 在浏览器端作为“候选人动态画像输入层”，只在测评完成度达到 60% 后参与个性化推荐。

### 基础岗位评价

| 层级 | 说明 |
|---|---|
| **Eligibility Gate** | 资格门槛：是否本科可投、是否 2027 届、是否硬性专业/语言/技能门槛，通过/不通过，不计分 |
| **Candidate Fit** | 职责、专业语言、真实经历、职业方向、可补足能力组成的岗位匹配 |
| **Fit Level** | 由匹配分及关键维度约束形成的纯适配等级（S++ / S / A / B / C / D） |
| **Data Quality** | 0–10，岗位信息来源可信度，独立于 Candidate Fit |
| **Recommendation Level** | 综合 Fit Level、Risk Deduction、Data Quality 后的最终投递推荐等级 |

未完成 Career Fit 或完成度低于 60% 时，系统完全沿用基础岗位评价，不改变任何原有 S/A/B。

## Career Fit V1.2 · 个性化推荐

Career Fit 测评覆盖 9 个方向：GTM·市场策略、外贸·海外业务、PMO·项目管理、跨境电商运营、品牌·内容·用户运营、产品·业务运营、国际物流·供应链、经营·商业分析、HR·HRBP。

测评包含三层信息：

- **兴趣**：36 个真实工作任务，1–5 分。
- **行为证据**：18 项，0–3 级（没做过 / 课程或类似经历 / 真实项目或实习 / 有成果可证明）。
- **工作方式**：8 项，包括驻外、英语工作、高频出差、拒绝、重复事务、长反馈周期、沟通、数字表格等。

完成度达到 60% 后：

1. 原基础评分里的 **职业方向价值 15 分** 不再使用固定方向偏好，而由 Career Fit 动态计算：兴趣 55% + 工作方式 30% + 行为证据 15%。
2. `职责 30 + 专业语言 20 + 真实经历 25 + 可补足能力 10` 保持原规则；系统额外计算一个归一化的 **能力准备度 Capability Score**，用于解释“做不做得来”。
3. 只有能与测评问题明确对应的个人摩擦项会动态调整：
   - 长期驻外 / 海外工作地点 → 读取“驻外接受度”；
   - 高频出差 → 读取“出差接受度”；
   - 强销售 KPI → 由“长反馈周期 + 主动承受拒绝”共同校准。
4. **Eligibility Gate、JD职责、专业语言、真实经历、Data Quality、公司外部风险不会被兴趣分覆盖。**
5. Data Quality = `PARTIAL` 时最终推荐仍然最高 B；Gate 不通过时永远不能被测评抬回正常等级。
6. 结果最终进入 `Priority Score / Recommendation Level`，所以做完测评后，公司/岗位 S/A/B 排序会出现有依据、可解释的个性化变化。

这套结构把两个问题分开：

- **岗位匹配/能力准备度**：现在能不能胜任、有没有竞争力；
- **职业方向/工作方式**：值不值得本人优先投入。

## 主要文件

| 文件 | 作用 |
|---|---|
| `index.html` | 看板页面（KPI 卡片、筛选、岗位列表、流程管线、图表、Offer 管理） |
| `scoring.js` | 基础评分引擎；保持与 Career Fit 解耦，确保无测评时原 S/A/B 回归不变 |
| `career-fit.js` | Career Fit V1.1 测评采集与职业方向画像 UI |
| `career-personalization.js` | Career Fit V1.2 个性化推荐层；完成度≥60%后动态替换职业方向价值并校准可对应的个人工作方式风险 |
| `career-fit.test.js` | Career Fit 空白、满分、最低分、部分作答、工作方式冲突及方向映射测试 |
| `career-personalization.test.js` | V1.2 个性化评分回归：60%门槛、四个客观能力维度不变、低兴趣降权、驻外动态风险、Gate/数据质量保护 |
| `yingzhuan-jobs.js` | 英专专项拆岗与精选岗位 |
| `shortlist.js` | 收窄投递清单（冲刺/主力/保底/待归类） |
| `docs/投递清单_2027届_收窄版.md` | 投递清单源文档 |
| `api/state.js` | 云同步后端（Vercel Serverless Function + Redis/KV） |
| `audit-intelligence-v1.3.cjs` | S-A-B 情报覆盖审计 |
| `calibrate-v1.1.js` / `calibrate-v1.2.js` | 基础推荐等级校准脚本 |
| `scoring-v1.1/v1.2/v1.3-quality/v1.4-industry.test.js` | 基础评分边界回归测试 |
| `.github/workflows/board-check.yml` | CI：基础评分、Career Fit、个性化推荐、实时岗位池校准、情报覆盖、生产接线校验 |

## 云同步设置（可选）

默认「我的投递」「Offer 对比」只存在当前浏览器 localStorage。要跨设备同步：

1. Vercel 项目 → **Storage** → Create Database → 选 Redis/KV 类 Marketplace 集成并绑定本项目。
2. Vercel 项目 → **Settings → Environment Variables** → 新增 `BOARD_SYNC_SECRET`。
3. 重新部署。
4. 打开看板 →「我的投递」→ 云同步 → 输入同一密码。

Career Fit 当前单独保存在浏览器 localStorage，因此不同浏览器/设备需要分别作答或后续再扩展画像同步。

## 数据依赖

- 实时岗位池与情报数据来自 [`lizhenhai2024-alt/AI_Job`](https://github.com/lizhenhai2024-alt/AI_Job)。
- 情报层覆盖 S / A / B 级公司风险历史与岗位薪资，并区分证据来源等级。

## CI

`board-check.yml` 在每次相关改动时执行：语法检查 → 基础评分边界测试 → Career Fit / 个性化推荐回归测试 → 当前实时岗位池校准 → 情报审计 → 生产接线与保护规则校验。

## 本地使用

```bash
git clone https://github.com/lizhenhai2024-alt/campus-job-board.git
cd campus-job-board
# 用浏览器打开 index.html
```

## License

[MIT](LICENSE) © 2026 Zhenhai Li/Bruce
