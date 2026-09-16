# campus-job-board · 风险情报契约

本仓库现在的职责是**发布并守住一份对下游的风险情报契约**。

原来的 Web 看板已摘除。候选人的最终 Eligibility、Match、Capability、Career Fit、Competition、Offer Reachability、Company Top-3 与投递建议统一由 `CareerPilot` 计算；`AI_Job` 只提供岗位事实与证据。

## 仓库里现在有什么

| 文件 | 角色 |
|---|---|
| `risk-intelligence.json` | **对外契约**：岗位风险规则、海外工作地点后处理、风险源声明、证据等级语义 |
| `scoring.js` | **被校验的历史兼容实现**：契约规则在这里有对应实现；不是当前候选人最终排序引擎 |
| `scripts/check-risk-contract.cjs` | 断言风险契约与实现一致 |
| `scoring-v1.*.test.js` | 历史内核边界回归测试 |
| `calibrate-v1.*.js` / `audit-*.cjs` | 无头校准/审计工具 |
| `决策边界_竞争强度与Offer可达性_V3.md` | 说明本仓库与 CareerPilot V3 决策层的边界 |

## 谁在消费

`CareerPilot/campus_risk.py` 按版本拉取 `risk-intelligence.json`，公司历史风险底层证据在 `AI_Job`。

数据职责固定为：

```text
AI_Job：岗位事实 / JD证据 / 薪资 / HC / 来源
    ↓
CareerPilot：候选人最终决策
    ↑
campus-job-board：风险情报契约
```

## 竞争强度与 Offer 可达性不是“风险扣分”

以下信息**不得**加入 `risk-intelligence.json` 的风险扣分：

- “专业不限”导致候选池更宽；
- 岗位热门、名企热门；
- 招聘人数多或少；
- 预计候选人背景强；
- 候选人缺少 GMV/ROI、PR/KOL、SQL/Python 等直接业务证据。

原因：这些都是**候选人决策层**的竞争/证据判断，不是招聘风险事件。它们由 CareerPilot 独立计算，不能污染 Capability/Career Fit，也不能和驻外、强销售 KPI、收费培训等风险混成一个扣分。

特别规则：只有 AI_Job 明确标注 `headcount.scope='job'` 的官方岗位级 HC 才可作为 CareerPilot 的上下文信息；`scope='program'` 永远不能当作岗位 HC，HC 未披露也不能算负面。

## 改一条风险规则

契约是对外承诺，`scoring.js` 是被校验实现，两边必须同步：

1. 修改 `scoring.js` 中对应风险实现；
2. 同步修改 `risk-intelligence.json`；
3. 运行 `node scripts/check-risk-contract.cjs`；
4. 再跑 `scoring-v1.*.test.js` / audit 回归。

> 不要为了让测试“通过”而把候选人竞争、Offer 可达性塞入风险层。V3 的最终决策只在 CareerPilot 中存在。

## 证据等级

公司历史风险事件按 A/B/C/D 分级：A（一手材料）、B（权威转述）高可信；C（社区线索）只作线索；D（未经核实）默认隐藏。公司历史风险不自动降低 Candidate Fit，也不形成公司黑名单。

## 本地验证

```bash
node scripts/check-risk-contract.cjs
node scoring-v1.1.test.js
node scoring-v1.2.test.js
node scoring-v1.3-quality.test.js
node scoring-v1.4-industry.test.js
```

需要真实岗位池时再运行：

```bash
node calibrate-v1.2.js AI_Job/src/data/live-jobs.js
node audit-regression.cjs AI_Job
node audit-intelligence-v1.3.cjs AI_Job
```

## 历史文件

`评价规则_*.md`、`docs/投递清单_*.md` 等保留用于历史追溯和校准。它们不能覆盖当前三库职责契约；最终候选人决策以 CareerPilot 当前规则为准。
