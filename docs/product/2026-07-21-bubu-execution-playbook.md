# BuBu 产品执行手册：本地化、低 Token、安全与增长

**状态：** Proposed  
**日期：** 2026-07-21  
**适用范围：** 产品、设计、工程、增长与商业化决策  
**事实约束：** 已交付能力必须以 `PRODUCT_MANIFEST.yaml` 为准。本文件中的目标态、实验和路线图不能被宣传为当前已上线能力。

> 文档入口：[`2026-07-21-bubu-strategy-index.md`](./2026-07-21-bubu-strategy-index.md)  
> 产品战略：[`2026-07-21-bubu-local-first-product-strategy.md`](./2026-07-21-bubu-local-first-product-strategy.md)

---

## 0. 决策摘要

BuBu 不应继续向“功能更多的 AI Spreadsheet”扩张，而应集中建立一个清晰品类：

> **BuBu — Private AI Data Workspace**
>
> **问数据，不交数据。第一次做分析，以后只换文件。**

产品必须同时证明四件事：

1. **数据主权**：原始行默认不进入远程模型，数据和计算结果以本地 Data Core 为权威。
2. **计算可信**：AI 生成受限 Typed Plan，本地代码负责计算、验证和执行。
3. **成本可控**：已验证分析编译为 Workflow，重放时尽可能实现零模型调用。
4. **工作可积累**：用户长期积累的是关系、规则、业务定义、Workflow 和证据，而不是不可复用的聊天记录。

当前最重要的产品楔子不是“自然语言问表”，而是：

> **Recurring File Operations：重复到来的 Excel/CSV，本月只替换文件，分析和报告自动安全重放。**

---

## 1. 战略楔子：先解决一种高频工作

### 1.1 首要目标用户

优先服务以下用户，而不是泛化到所有 Excel 用户：

- 每周或每月收到结构相似 CSV/XLSX 的财务、运营、销售运营人员；
- 为多个客户重复处理文件的顾问、记账人员和外包分析人员；
- 数据敏感、无法随意上传文件，但没有完整数据团队的中小企业；
- 需要关联客户、订单、退款、广告、库存等多张表的业务人员。

### 1.2 首要 Job to Be Done

> 当新一期文件到达时，我需要检查格式变化、关联多张表、执行固定指标和异常检查、生成可交付报告；我不希望上传原始数据，也不希望每月重写公式或重新解释需求。

### 1.3 为什么这个楔子成立

一次性 AI 问答容易被 ChatGPT、Excel Copilot、Gemini、Julius 和其他工具替代；重复工作同时需要版本、Schema Drift、关系、校验、恢复、证据和工作流，竞争门槛明显更高。

BuBu 的付费价值因此应从“回答问题”升级为：

```text
一次理解
→ 一次审核
→ 编译为 Workflow
→ 每次换文件自动检查
→ 无变化则零 AI 重放
→ 有变化才局部调用 AI
```

### 1.4 非目标用户

当前不优先服务：

- 需要完整 Excel 公式兼容和复杂单元格编辑的重度财务建模用户；
- 以多人实时协作为第一需求的在线表格团队；
- 需要云数仓全公司自助 BI 的大型数据团队；
- 只偶尔分析一份公开、无敏感性的文件且不需要复用的人群。

---

## 2. 产品权威边界

BuBu 必须维持四层分工，避免把不确定性和权限全部交给模型。

### 2.1 Data Plane：本地事实层

负责：

- 文件、Dataset、Dataset Version；
- Schema、Profile、Quality Rules；
- Relationships、Group Membership；
- Typed QueryPlan / TransformPlan 校验；
- SQLite 只读或受控事务执行；
- Workflow State、Checkpoint、Artifact、Audit。

原则：

> 数据、计算结果和执行状态只有 Data Plane 可以声明为事实。

### 2.2 Intelligence Plane：有限语义层

负责：

- 意图识别；
- 字段和业务概念映射；
- QueryPlan、JoinPlan、TransformPlan 草案；
- 聚合结果解释；
- 报告叙事和异常假设。

禁止：

- 直接执行任意 SQL；
- 自行提高披露等级；
- 自行注册工具；
- 自行授权网络、文件或外部写入；
- 把模型输出当成数据事实。

### 2.3 Control Plane：Harness 与 Policy

负责：

- Context Compiler；
- Model Router；
- Tool Registry；
- Disclosure Policy；
- Approval；
- Token、Tool、Turn、Time、Cost Budget；
- Cancellation、Retry、Checkpoint、Trace、Eval。

### 2.4 Integration Plane：Connector 与 MCP

负责连接外部文件、数据库、SaaS 和工具，但不拥有数据披露和产品权限。

```text
Connector / MCP
→ 规范化输入
→ Control Plane 判定风险和权限
→ Data Plane 决定本地写入或执行
```

---

## 3. 低 Token 架构：目标是减少模型调用

### 3.1 指标定义

不要只统计单次请求 Token，应统计：

```text
Tokens Per Successful Task
Model Calls Per Successful Task
Cost Per Successful Workflow Run
Zero-Model Replay Rate
```

### 3.2 Progressive Context Ladder

```text
L0 Intent only
L1 Dataset names and compact schema
L2 Relevant columns, semantic profile and relationships
L3 Locally generated synthetic examples
L4 User-approved aggregate evidence
L5 Explicit rows under one-use approval
```

每一步默认从最低等级开始。模型需要更多上下文时，只能返回结构化 `context_request`，由 Policy Evaluator 决定是否允许升级。

### 3.3 Context Compiler

本地编译最小上下文：

- 只检索与当前意图相关的 Dataset；
- 只发送候选列而不是完整 Schema；
- 发送语义类型、Null、Unique、Range、枚举摘要和关系；
- 删除本地路径、真实标识符、无关列和完整历史；
- 使用稳定 ID 替代重复自然语言；
- 用版本指纹引用已知关系和业务定义。

### 3.4 Model Call Gate

以下任务默认不调用模型：

- 重放已审批 Workflow；
- 执行已缓存 Typed Plan；
- 修改排序、筛选、图表布局；
- Schema 未变化的定时任务；
- 已知字段映射；
- 确定性质量规则；
- 已执行结果的固定模板报告。

只有新意图、不兼容漂移、关系冲突、定义缺失或 Plan 无法由规则选择时，才进入模型调用。

### 3.5 Plan Cache

缓存的是经过验证的计划，不是自然语言答案。

```text
normalized_intent
+ dataset_contract_fingerprint
+ relationship_graph_version
+ business_dictionary_version
+ skill_version
+ privacy_policy_version
+ provider_capability_profile
```

### 3.6 Workflow Compilation

一次成功分析经过确认后编译为 Workflow：

```text
Input Contract
→ Drift Check
→ Quality Rules
→ Relationship Validation
→ Typed Plan
→ Local Execution
→ Artifact Generation
→ Proof Card
```

后续运行先检查输入契约。兼容则零模型重放；局部变化只重新规划受影响节点。

### 3.7 模型路由

- 代码与规则：确定性任务；
- 本地小模型：路由、字段匹配、简单分类；
- 中模型：新 QueryPlan、JoinPlan；
- 强模型：复杂解释、跨结果综合；
- Reviewer：仅高风险、低置信度或重要交付启用。

### 3.8 Token Receipt

每次模型调用显示：

- 为什么需要 AI；
- Provider 和 Endpoint；
- 输入、输出 Token；
- 真实数据行数量；
- Schema 字段数量；
- 合成样例数量；
- 披露等级；
- 预计和实际成本；
- Cache 命中状态。

Token Receipt 同时是成本、隐私和工程效率证明。

---

## 4. 三个本地化等级

### 4.1 Local Data

- 原始数据、SQLite、查询和 Artifact 本地；
- 可选远程模型；
- 只发送 Disclosure Envelope；
- 默认远程原始行数为 0。

### 4.2 Local Intelligence

- 模型、Embedding、Reranker、RAG 全部本地；
- 无远程 Provider；
- 可启用经过批准的本地 MCP；
- 模型与索引均通过本地版本和哈希管理。

### 4.3 Air-Gapped Local Lock

- 网络 Deny-by-default；
- 无 Hub、遥测、远程 MCP 和远程 Provider；
- 模型、Skill、规则和更新通过离线签名包导入；
- 诊断包由用户显式导出；
- 备份、恢复、审计和清理全部离线。

### 4.4 Local Proof 页面

产品应提供可验证状态页：

- 当前本地化等级；
- 远程 Provider 是否启用；
- 网络白名单；
- 本地模型名称、来源和哈希；
- MCP 权限和进程；
- 最近远程请求；
- 最近披露等级；
- 最近原始行披露数；
- 审计完整性状态。

---

## 5. 安全威胁模型

### 5.1 Spreadsheet Prompt Injection

单元格、列名、文件名和注释都视为数据，不允许改变系统规则、Tool Registry、Disclosure、Budget 和 Approval。

### 5.2 CSV / Formula Injection

导出时对以 `=`, `+`, `-`, `@` 开头的文本执行公式硬化。预览、报告和 HTML 渲染不执行数据内代码。

### 5.3 Model Exfiltration

模型只能看到 Data Core 生成的 Disclosure Envelope；不得访问本地文件路径、数据库句柄、Secret、原始 Tool Result 或其他 Dataset。

### 5.4 MCP Server Abuse

- Server 描述和 Annotation 不构成信任证明；
- 禁止 Shell 和包运行器；
- 不继承主进程环境；
- 每次连接重新解析可执行文件和参数；
- Tool 每轮重新按 Policy 过滤；
- Tool Result 不能扩大后续权限。

### 5.5 Connector Overreach

Connector 权限按来源、资源、动作和时间范围最小化。读取权限和写入权限分开；Import、Sync、External Write 使用不同审批。

### 5.6 Join Explosion

关联前验证 Cardinality、唯一性、Null、重复率和预计输出行数。超过预算时阻断，不能依赖模型解释风险。

### 5.7 Schema Drift Misbinding

新版本字段不得仅凭相似名称自动绑定。需结合类型、分布、语义、历史关系和用户确认，并展示影响范围。

### 5.8 Audit Gap

所有高风险操作先写 Start Audit，再执行，最后写单一 Success 或 Failure。重启后将无终态操作标记为 Interrupted。

### 5.9 Backup Leakage

备份必须包含隐私级别、版本、哈希、加密和恢复验证；不允许把 Secret、临时明文和未批准 Disclosure 放入备份。

### 5.10 Local Process Compromise

Renderer、Electron Main、AI Utility、Data Core 和 MCP 必须维持窄 RPC、独立生命周期、最小环境和错误隔离。不能因“本地运行”就假设安全。

---

## 6. 产品特异功能

### 6.1 Zero-Row Guarantee

默认界面持续显示：

> **0 raw rows sent to remote AI.**

一旦任务需要具体行，状态必须显著变化并进入独立审批，不得静默升级。

### 6.2 Disclosure Lens

在请求前显示：目的、Provider、Endpoint、字段、合成样例、聚合、Token、成本、排除内容、审批有效期和单次授权。

### 6.3 Proof Card

每个结果附带：Dataset Version、Schema Fingerprint、Plan、关系、过滤条件、执行时间、Evidence、Disclosure、Token、Cost 和 Audit ID。

### 6.4 Replace & Replay

```text
替换文件
→ Schema Drift
→ Change Impact
→ 字段映射
→ Shadow Validation
→ Workflow Replay
→ Report Refresh
```

### 6.5 Workflow Capsules

将重复任务保存为包含输入契约、质量规则、关系、计划、报告、触发、审批、预算和失败条件的业务胶囊。

### 6.6 Local Business Dictionary

保存企业业务定义、指标口径、字段别名和规则。定义缺失或冲突时必须询问，不能由模型静默发明。

### 6.7 Change Impact Graph

字段、关系或定义变化时，展示受影响的 Workflow、QueryPlan、Report、Rule、Trigger 和 Dataset Group。

### 6.8 Shadow Run

自动化 Workflow 首次运行时，与旧 Excel、人工结果或上期结果并行比较。差异超过阈值时不得进入自动触发。

### 6.9 Local Data Inbox

监听用户批准的本地目录：发现新文件、匹配 Dataset、检查 Schema，并等待用户批准替换和运行。默认不上传、不自动执行外部副作用。

### 6.10 Why AI?

每个模型调用都必须解释为什么本地代码、缓存计划和已有 Workflow 无法完成。无法说明时，默认取消模型调用。

---

## 7. 竞争策略

### Excel Copilot

学习 Plan、Edit、Chat 分离和撤销；不竞争完整 Excel 编辑器。BuBu 对应 Ask、Plan、Run、Automate。

### Gemini in Sheets

学习低门槛和快速产出；不追求在线多人协作，强调敏感数据、本地执行和重复作业。

### Quadratic

学习可检查的公式、代码、Connector、API 和 MCP；BuBu 用 Local Data Core、Disclosure、Workflow 和权限防火墙差异化。

### Equals

学习 `No AI Math`。BuBu 延伸为：

> **No AI Math. No AI SQL Execution. No Raw Rows by Default.**

### Hex

学习 Context、Semantic Definitions、Observability 和 Agent Eval；BuBu 应建立 Business Dictionary、Context Compiler 和 Eval Replay。

### Julius

学习快速首次价值和漂亮 Artifact；BuBu 必须优先补齐 Report，而不是继续增加底层能力。

---

## 8. 推广与增长

### 8.1 主叙事

> **Ask your data. Keep your data.**

> **第一次做分析，以后只换文件。**

### 8.2 三个必做 Demo

1. 工资表没有交给 AI；
2. 三张表，不写 VLOOKUP；
3. 本月只替换 CSV，报告自动更新。

### 8.3 内容漏斗

- 信任内容：AI 到底看到了什么；
- 效率内容：重复报表只做一次；
- 技术内容：No AI SQL Execution；
- 对比内容：BuBu vs ChatGPT / Excel Copilot / Julius / Quadratic；
- 行业内容：财务、运营、顾问和敏感业务数据案例。

### 8.4 包装假设

- Free：基础本地文件、有限 Dataset 和一个 Workflow；
- Pro：多表、版本、Replace & Replay、Proof、Report、BYOK；
- Analyst：Database Connector、Business Dictionary、Local RAG、高级 Workflow 和 MCP；
- Enterprise：只有 Hub、RBAC、策略、审计、签名部署和支持能力真实完成后再销售。

---

## 9. 90 天执行计划

### Day 1–30：首次价值与信任

- Report Artifact；
- Disclosure Lens；
- Proof Card；
- Token Receipt；
- 首次导入和首问引导；
- 90 秒 Demo；
- 测量 Time to First Verified Insight。

### Day 31–60：重复作业闭环

- Replace & Replay 主入口；
- Workflow Compilation；
- Zero-Model Replay；
- Schema Drift 影响检查；
- 3–5 个 Workflow Capsules；
- Shadow Run。

### Day 61–90：语义、增长和商业验证

- Local Business Dictionary；
- Context Compiler；
- Change Impact Graph；
- 对比页面和安全页面；
- Local Model 性能矩阵；
- 定价实验；
- 10–20 名目标用户重复任务验证。

---

## 10. 决策指标

核心指标：

- Time to First Verified Insight；
- QueryPlan Execution Success Rate；
- Zero-Row Remote Disclosure Rate；
- Model Calls Per Successful Task；
- Tokens Per Successful Task；
- Zero-Model Replay Rate；
- Workflow Second-Run Rate；
- Replace & Replay Adoption；
- Shadow Run Match Rate；
- Human Correction Rate；
- Weekly or Monthly Retained Workflow Users；
- 未审批披露、Raw SQL、MCP 越权、Secret 泄漏和审计缺口次数，目标为 0。

---

## 11. 停止条件

新功能至少应改善以下一项：

- Activation；
- Trust；
- Token Efficiency；
- Workflow Replay；
- Retention；
- Revenue。

没有明确指标收益时，停止：

- 新增 Agent；
- 新增 Connector；
- 扩大 MCP；
- 构建自由多 Agent 对话；
- 扩展完整 Spreadsheet 编辑；
- 提前建设泛化企业平台。

最终原则：

> **BuBu 的价值不在于让 AI 看见更多数据，而在于让 AI 用更少的数据、更少的调用和更少的权限，持续完成更多可验证工作。**
