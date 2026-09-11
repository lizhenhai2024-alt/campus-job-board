# campus-job-board · 2027届校招机会看板

![CI](https://github.com/lizhenhai2024-alt/campus-job-board/actions/workflows/board-check.yml/badge.svg) ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

面向 **2027 届校招**的岗位适配度评价看板，为候选人（湖南大学英语本科）提供岗位的资格判断、适配评分、风险调整与投递推荐排序。

> 数据职责分工：`AI_Job` 负责岗位发现、官网/ATS 抓取、去重、JD 结构化和来源核验；本仓库独立负责最终资格判断、适配评价、风险调整和推荐排序。

## 核心模型

主看板仍是 **V1.2**。英专专项看板另有 **V2.0**（人岗五维 P，公司层 A/B/C 不进分），规则见 [`评价规则_2027届校招岗位适配度_V2.0.md`](评价规则_2027届校招岗位适配度_V2.0.md)，网页：[英专看板](https://lizhenhai2024-alt.github.io/)。

### V1.2（本仓库评分引擎）

评价分五层，互不混淆：

| 层级 | 说明 |
|---|---|
| **Eligibility Gate** | 资格门槛：是否本科可投、是否 2027 届、是否硬性专业/语言/技能门槛，通过/不通过，不计分 |
| **Candidate Fit** | 0–100，只回答候选人与岗位本身是否匹配 |
| **Fit Level** | 由 Candidate Fit 及关键维度约束形成的纯适配等级（S++ / S / A / B / C / D） |
| **Data Quality** | 0–10，岗位信息来源可信度，独立于 Candidate Fit |
| **Recommendation Level** | 综合 Fit Level、Risk Deduction、Data Quality 后的最终投递推荐等级 |

典型示例：岗位 Fit Level = A、Candidate Fit = 81，但长期海外工作地点风险 -15，Priority Score = 66，最终 Recommendation Level = B。

## 主要文件

| 文件 | 作用 |
|---|---|
| `index.html` | 看板页面（KPI 卡片、筛选、岗位列表、流程管线、图表、Offer 管理） |
| `scoring.js` | 评分引擎（原 `scoring-v1.1.js` + 语言 / 校准 / 质量三层 patch 合并，逻辑未变） |
| `yingzhuan-jobs.js` | 英专专项拆岗（绿联、倍思、TP-Link、网易游戏、联合利华、韶音、大华、科沃斯、大疆、有道、影石、携程）。实时岗位池缺这些公司时合并进来，并钉在「按公司」视图顶部；不改 V1.2 `scoring.js` |
| `api/state.js` | 云同步后端（Vercel Serverless Function + Vercel Marketplace 的 Upstash Redis） |
| `audit-intelligence-v1.3.cjs` | S-A-B 情报覆盖审计（开发期诊断脚本，已改引用 `scoring.js`） |
| `calibrate-v1.1.js` / `calibrate-v1.2.js` | 推荐等级校准（开发期诊断脚本，保留供历史对照，已改引用 `scoring.js`） |
| `scoring-v1.1/v1.2/v1.3-quality.test.js` | 评分边界回归测试 |
| `评价规则_…V1.2.md` / `情报层规则_…V1.3.md` | V1.2 适配规则 + 情报层（冻结） |
| `评价规则_…V2.0.md` | 英专看板人岗五维 P（公司层不进分） |
| `.github/workflows/board-check.yml` | CI：语法检查、测试、实时岗位池校准、情报覆盖审计、接线校验 |

## 云同步设置（可选）

默认「我的投递」「Offer 对比」只存在当前浏览器 localStorage。要跨设备同步：

1. Vercel 项目 → **Storage** → Create Database → 选一个 Redis/KV 类的 Marketplace 集成（如 Upstash for Redis），绑定到本项目（自动注入 `KV_REST_API_URL` / `KV_REST_API_TOKEN`，无需手动填）。
2. Vercel 项目 → **Settings → Environment Variables** → 新增 `BOARD_SYNC_SECRET`，值自己定一个密码。
3. 重新部署一次（改环境变量后 Vercel 需要重新部署才生效）。
4. 打开看板 →「我的投递」页 → 云同步面板 → 输入同一个密码 → 启用同步。每台设备都输入同一个密码即可自动互相同步。

不设置以上步骤也完全不影响看板本身使用，只是投递记录不会跨设备同步（和之前一样）。

## 数据依赖

- 实时岗位池与情报数据来自 [`lizhenhai2024-alt/AI_Job`](https://github.com/lizhenhai2024-alt/AI_Job)（交叉仓库，CI 会自动检出）。
- 情报层覆盖 S / A / B 级公司风险历史与岗位薪资，并区分证据来源等级。

## CI

`board-check.yml` 在每次改动推送时自动运行：语法检查 → 边界测试 → 对当前实时岗位池校准 V1.2 → 审计情报覆盖 → 校验情报源文件与生产接线。

## 本地使用

```bash
# 克隆仓库后直接用浏览器打开
git clone https://github.com/lizhenhai2024-alt/campus-job-board.git
cd campus-job-board
# 打开 index.html 即可
```

## License

[MIT](LICENSE) © 2026 Zhenhai Li/Bruce
