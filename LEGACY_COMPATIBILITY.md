# Legacy / Compatibility Boundary

`campus-job-board` 当前正式职责只有一项：**发布风险情报契约 `risk-intelligence.json` 并保证契约与历史风险实现一致。**

以下文件仍留在仓库根目录，是为了避免破坏既有测试、审计脚本和下游兼容引用；逻辑上视为 **legacy / compatibility 区**，不是新的候选人决策入口：

- `scoring.js`
- `scoring-v1.*.test.js`
- `calibrate-v1.*.js`
- `audit-*.cjs`
- `query-layer-adapter.js`
- 历史 `评价规则_*.md`、`决策边界_*.md`、`docs/投递清单_*.md`

## 冻结规则

1. 不在这些文件中新增 Match / Capability / Career Fit / Competition / Offer Reachability / Decision Score / Company Top3 等候选人最终决策逻辑。
2. `scoring.js` 只允许为 `risk-intelligence.json` 的风险规则做兼容实现和回归验证。
3. 新风险规则必须先定义在 `risk-intelligence.json`，再同步兼容实现，并通过 `scripts/check-risk-contract.cjs`。
4. 候选人最终决策规则、权重和投递优先级统一在 `CareerPilot` 维护；当前最终规范为 CareerPilot V4.1。
5. AI_Job 的岗位采集范围和事实字段由 AI_Job 自己治理，campus 不得二次改写岗位事实。

暂不物理移动这些文件，是为了避免大量历史 import/脚本路径失效。若未来要迁移到 `compat/` 或 `legacy/`，必须单独做路径兼容和完整回归，不与规则调整混在一次变更中。
