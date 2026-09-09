# campus-job-board · 2027届校招机会看板

面向 **2027 届校招**的岗位适配度评价看板，为候选人（湖南大学英语本科）提供岗位的资格判断、适配评分、风险调整与投递推荐排序。

> 数据职责分工：`AI_Job` 负责岗位发现、官网/ATS 抓取、去重、JD 结构化和来源核验；本仓库独立负责最终资格判断、适配评价、风险调整和推荐排序。

## 核心模型（V1.2）

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
| `scoring-v1.1.js` 及 patches | 评分引擎与语言 / 校准 / 质量补丁 |
| `app-v1.1.js` / `ui-v1.2-patch.js` | 应用逻辑与 UI 增强 |
| `intelligence-v1.3-patch.js` | 岗位薪资与公司风险情报层 |
| `audit-intelligence-v1.3.cjs` | S-A-B 情报覆盖审计 |
| `calibrate-v1.1.js` / `calibrate-v1.2.js` | 推荐等级校准 |
| `scoring-v1.1/v1.2/v1.3-quality.test.js` | 评分边界回归测试 |
| `评价规则_…V1.2.md` / `情报层规则_…V1.3.md` | 规则文档（冻结版本） |
| `.github/workflows/board-check.yml` | CI：语法检查、测试、实时岗位池校准、情报覆盖审计、接线校验 |

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

见 [LICENSE](LICENSE)。
