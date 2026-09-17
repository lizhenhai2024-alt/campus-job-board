# campus-job-board · 风险情报契约

本仓库当前职责是**发布并守住一份对下游的风险情报契约**。

原 Web 看板已摘除。候选人的最终 Eligibility、Match、Capability、Career Fit、Competition、Direct Evidence、Offer Reachability、Company Top-3 与投递建议统一由 `CareerPilot` 计算；`AI_Job` 负责英语专业本科生岗位事实与证据采集。

## 仓库里现在有什么

| 文件 | 角色 |
|---|---|
| `risk-intelligence.json` | **正式对外契约**：岗位风险规则、海外工作地点后处理、风险源声明、证据等级语义 |
| `scoring.js` | **历史兼容实现**：契约风险规则的兼容代码；不是候选人最终排序引擎 |
| `scripts/check-risk-contract.cjs` | 断言风险契约与兼容实现一致 |
| `scoring-v1.*.test.js` | 历史内核边界回归测试 |
| `calibrate-v1.*.js` / `audit-*.cjs` | 历史无头校准/审计工具 |
| `query-layer-adapter.js` | 历史数据适配兼容层，不是新的事实或决策源 |
| `LEGACY_COMPATIBILITY.md` | 明确上述历史文件的冻结边界 |

## 三库数据职责

```text
AI_Job
  2027届英语专业本科岗位事实 / JD证据 / 薪资 / HC / 来源
  生产池已排除明显技术、财会金融、法律等专业岗
    ↓
CareerPilot
  唯一候选人最终决策引擎（当前 V4.1）
    ↑
campus-job-board
  risk-intelligence.json 风险情报契约
```

## 兼容区冻结原则

`scoring.js`、`scoring-v1.*.test.js`、`calibrate-v1.*.js`、`audit-*.cjs`、`query-layer-adapter.js` 等文件继续留在根目录，主要为了避免破坏历史脚本和测试路径；逻辑上全部视为 **legacy / compatibility 区**。

这些文件不得新增：

- Match / Capability / Career Fit
- Competition / Offer Reachability
- Direct Evidence
- Decision Score / Bucket
- Company Top3
- 候选人最终 S/A/B 或投递排序

当前候选人决策规范统一以 `CareerPilot/DECISION_RULES.md` V4.1 为准。

## 竞争强度与 Offer 可达性不是“风险扣分”

以下信息不得加入 `risk-intelligence.json` 的风险扣分：

- “专业不限”导致候选池更宽；
- 岗位热门、名企热门；
- 招聘人数多或少；
- 预计候选人背景强；
- 候选人缺少 GMV/ROI、PR/KOL、SQL/Python 等直接业务证据。

这些属于 CareerPilot 的候选人决策层，不是招聘风险事件。

只有 AI_Job 明确标注 `headcount.scope='job'` 的岗位级 HC 才可作为 CareerPilot 上下文；`scope='program'` 永远不能当岗位 HC，HC 未披露也不能算负面。

## 改一条风险规则

契约是对外承诺，`scoring.js` 只是被校验的历史兼容实现。两边必须同步：

1. 修改 `risk-intelligence.json`；
2. 同步 `scoring.js` 中对应风险实现；
3. 运行 `node scripts/check-risk-contract.cjs`；
4. 再跑 `scoring-v1.*.test.js` / audit 回归。

不得为了测试通过而把候选人 Competition / Offer Reachability / Match 塞回风险层。

## 证据等级

公司历史风险事件按 A/B/C/D 分级：

- A：一手材料；
- B：权威转述；
- C：社区线索，只作线索；
- D：未经核实，默认隐藏。

公司历史风险不自动降低 Candidate Fit，也不形成公司黑名单。

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

`评价规则_*.md`、`决策边界_*.md`、`docs/投递清单_*.md` 等只用于历史追溯和校准，不能覆盖当前三库职责契约。
