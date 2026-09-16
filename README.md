# campus-job-board · 风险情报契约

本仓库现在的职责是**发布并守住一份对下游的风险情报契约**。

原来的 Web 看板（`index.html` / `app.js` / `app-core.js` / `api/` / Career Fit 展示层）已摘除。
看板下线不影响本仓库的存在理由：下游消费的是 `risk-intelligence.json`，从来不是那个网页。

## 仓库里现在有什么

| 文件 | 角色 |
|---|---|
| `risk-intelligence.json` | **对外契约**。岗位风险规则、海外工作地点后处理、风险源声明、证据等级语义 |
| `scoring.js` | **被校验的规则实现**。契约里的每条规则在这里都有 `risk()` / `patchRisk()` 的对应实现 |
| `scripts/check-risk-contract.cjs` | 断言上面两者一致 + 契约自身自洽（CI 主检查） |
| `scoring-v1.*.test.js` | 内核打分边界测试 |
| `calibrate-v1.*.js` / `audit-*.cjs` | 无头工具：拿 AI_Job 真实岗位池校准与回归 |

契约独立于任何展示层，所以看板摘除后这条链路照常成立。

## 谁在消费

`CareerPilot/campus_risk.py` 按版本拉取本契约来算岗位风险扣分，不再手抄正则。
公司历史风险事件的底层证据库在 `AI_Job`，契约的 `riskSources` 声明了它的地址。

## 改一条风险规则

契约是**对外承诺**，`scoring.js` 是内部实现，两者必须同时改，否则 CI 会红：

1. 改 `scoring.js` 里 `risk()` / `patchRisk()` 的实现
2. 同步改 `risk-intelligence.json` 里对应的 `deduction` / `pattern`
3. `node scripts/check-risk-contract.cjs` 应在改完两边后通过

CI 会双向比对：契约里有的规则 `scoring.js` 里必须有，`scoring.js` 里有的契约里也必须有，
正则逐字比对，扣分上限和后处理分支同样比对。漂移过一次（下游手抄的 Python 正则静默过时），
所以这道检查是刻意的。

> `scoring.js` 是**被校验方**。不要为了让它"通过"而改它的规则实现——要改的是两边一起。

## 证据等级

公司历史风险事件按 A/B/C/D 分级：A（一手材料）、B（权威转述）高可信；C（社区线索）只作线索；
D（未经核实）**默认隐藏**。契约里的 `evidenceLevels.D.display = false` 是对下游的明确承诺，CI 断言它。

公司历史风险不自动降低 Candidate Fit，也不形成公司黑名单。

## 本地验证

```bash
node scripts/check-risk-contract.cjs
node scoring-v1.1.test.js   # 另有 v1.2 / v1.3-quality / v1.4-industry
```

内核相关的集成检查需要一份 AI_Job checkout：

```bash
node calibrate-v1.2.js AI_Job/src/data/live-jobs.js
node audit-regression.cjs AI_Job
node audit-intelligence-v1.3.cjs AI_Job
```

## 历史

评分规则的设计依据保留在 `评价规则_*.md` 与 `情报层规则_*.md`；
`docs/投递清单_2027届_收窄版.md` 是个人投递清单，可用 `scripts/build-shortlist.cjs` 重新生成。
