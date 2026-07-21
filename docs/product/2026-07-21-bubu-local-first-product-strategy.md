# BuBu 本地优先产品战略

**状态：** Proposed  
**日期：** 2026-07-21  
**事实基线：** `PRODUCT_MANIFEST.yaml` 是能力是否交付的唯一依据；Planned 和 In Progress 能力不得提前包装为已上线。

## 1. 核心定位

BuBu 不应被定义为“AI Excel”或“自然语言转 SQL 工具”。Microsoft Copilot 已进入 Excel 的编辑、规划和聊天流程；Gemini 已进入 Sheets；Quadratic 正以 AI Spreadsheet、数据库连接、MCP 和 API 扩张；Equals 用“No AI Math”建立可信分析；Hex 以企业语义上下文和 Agent 评测构建企业壁垒。

BuBu 应定义为：

> **BuBu — Private AI Data Workspace**
>
> **问数据，不交数据。**

完整承诺：原始 Excel、CSV 和本地数据库数据默认不进入远程模型。AI 只负责理解问题和提出受限计划，本地数据内核负责计算、验证、执行和保存证据；一次成功分析可以保存为工作流，下次只需替换数据。

产品差异由六部分组成：

1. **Local Authority**：本地数据和本地执行结果是权威事实。
2. **Bounded AI**：模型受上下文、工具、回合、时间、Token 和权限预算约束。
3. **Visible Disclosure**：用户准确看到什么内容将离开设备。
4. **Deterministic Execution**：模型输出 Typed Plan，本地代码计算和校验。
5. **Repeatable Workflows**：一次分析升级为可重放、可恢复、可审计流程。
6. **Proof over Prose**：结论附带数据版本、查询计划、执行和披露证据。

一句话：

> **AI plans. BuBu calculates. You verify.**

## 2. 当前能力基线

截至 2026-07-21，仓库已具备：

- Electron 安全桌面壳、沙箱化 React、Node AI Utility、Go Data Core；
- 本地 SQLite、CSV/XLSX 导入、版本管理、Schema Drift 和字段映射；
- 列画像、质量评分、验证规则、多表关系和受控 Join；
- Typed Query Plan、可见审批、本地有界执行；
- Schema-only、Synthetic、Approved Aggregate 等披露边界；
- 一次性聚合审批、披露账本、Token 审计和带引用解释；
- 固定回合、工具、时间和 Token 预算的 Aggregate Agent；
- 工作流版本、幂等、重试、Checkpoint、取消和触发队列；
- 本地 MCP 注册、受控启动、能力发现、Resource Read、Prompt Get；
- OpenAI、Anthropic、Gemini、兼容 API 和 Ollama Provider。

仍需按路线图标记：Report、完整 Bounded Agents、MCP Tool Execution、Local RAG、Hub、RBAC、Sync 和 Signed Installer。

## 3. 波特五力结论

### 现有竞争：极高

原生办公、通用文件分析、AI Spreadsheet 和企业分析 Agent 四条赛道同时竞争。BuBu 不应拼功能数量，应拼：

```text
隐私边界 × 可验证执行 × 重复流程 × 本地自主权
```

### 替代品：极高

Excel、Power Query、Python、SQL、BI 和通用模型都能完成一次分析。BuBu 的付费价值必须来自：敏感数据不上传、流程可重复、结果可验证、Schema Drift 可管理、失败可恢复。

### 新进入者：高

CSV 解析和 LLM 调用容易复制，难复制的是本地内核、版本关系、Typed Plan、披露审批、工作流恢复、跨模型适配和长期业务规则。

### 买方议价能力：高

如果只是聊天工具，切换成本接近零。BuBu 应积累可导出的字段语义、关系、质量规则、业务定义、Workflow、模板和审计历史，形成真实使用资产。

### 供应商议价能力：中高

坚持模型中立、BYOK、本地模型、Capability Negotiation。模型永远不能成为数据、权限和计算的最终权威。

### 战略选择

采用集中差异化，优先服务：经常处理重复 CSV、Excel 导出和敏感业务数据，但没有成熟数据团队的运营、财务、销售运营、顾问和小型企业。

核心 Job：

> 每周或每月收到结构相似但内容更新的文件，需要校验、关联、计算、找异常和出报告，但不想上传原始数据，也不想每次重做公式。

## 4. 三种运行模式

### Local Lock：彻底本地

- 本地模型、Embedding、Reranker、FTS5 和本地向量索引；
- 无 Hub、无远程 Provider、无远程 MCP；
- 网络默认拒绝，只允许显式白名单；
- 文件、对话、Workflow、Audit、Artifact 全部保留在设备；
- 无默认遥测，诊断包由用户主动导出；
- 离线模型、离线备份和签名更新包。

宣传：

> **Local Lock — Air-gapped AI data work.**

### Local Private：默认本地优先

原始数据和计算留在本地，可选远程模型，但只能按级别披露：

1. Schema Only；
2. Schema + 不可逆合成样例；
3. 用户批准的聚合；
4. 单次明确批准的具体行。

Prompt、模型、Skill、Workflow 和 MCP 不能自行提升披露等级。

### Controlled Enterprise：受控企业模式

未来 Hub 默认只同步身份、策略、Workflow、Skill、Connector 元数据和审计摘要。原始数据同步必须是独立权限，不能与协作默认绑定。

## 5. 省 Token 体系

最有效的方法不是压缩 Prompt，而是让数据不进入模型。

### 5.1 Progressive Context Ladder

```text
L0 Intent only
L1 Dataset names + compact schema
L2 Schema + semantic profile + relations
L3 Synthetic examples
L4 Approved aggregate evidence
L5 Explicit rows after one-use approval
```

模型只获得当前步骤最低必要上下文。上下文不足时返回结构化 `context_request`，由 Policy Engine 决定是否升级。

### 5.2 Context Compiler

本地将数据目录编译成紧凑 Schema Digest：列类型、语义、唯一性、空值、关系、版本指纹和安全统计。不得发送原始路径、真实值、无关列和完整聊天历史。

### 5.3 Model Call Gate

以下动作默认不调用模型：

- 重放已批准 Workflow；
- 修改排序、筛选和图表；
- 执行已缓存 Typed Plan；
- 重新生成确定性报告；
- Schema 未变化的定时任务。

只有新意图、新 Schema、新关系或语义冲突才调用模型。

### 5.4 Plan Cache

缓存键：

```text
normalized_intent
+ schema_fingerprint
+ relationship_graph_version
+ skill_version
+ privacy_policy_version
+ model_capability_profile
```

缓存已验证 Typed Plan，不缓存不可验证的自然语言答案。

### 5.5 Workflow Compilation

一次成功分析编译为确定性 Workflow。后续只检查数据版本和漂移；只有不兼容变化才重新进入 Agent。

### 5.6 分层模型路由

- 规则和代码：明确意图与已存在计划；
- 小模型：Router、字段映射、简单 Schema 解释；
- 中模型：新 QueryPlan、Join Plan；
- 强模型：复杂分析和报告综合；
- Reviewer：仅高风险、低置信度或高价值任务启用。

### 5.7 有界输出与 Token Receipt

所有调用使用固定 JSON Schema、最大输出 Token 和证据 ID。UI 显示：

```text
远程调用：1 次
输入：1,842 tokens
输出：623 tokens
真实数据行：0
Schema 字段：14
合成样例：3
预计成本：$0.004
```

Token 账单同时是成本证明和隐私证明。

## 6. 安全与本地化基线

### 数据边界

- Renderer 不直接访问文件、数据库或 AI Utility；
- Go Data Core 是原始数据披露、Plan 校验和 SQL 执行的最终权威；
- Node AI Runtime 只接收 Data Core 生成的 Disclosure Envelope；
- 模型、MCP、Connector 和单元格文本均视为 Untrusted Data。

### No AI SQL Execution

宣传原则：

> **No AI Math. No AI SQL Execution. No Raw Rows by Default.**

模型只能输出 Typed QueryPlan/TransformPlan。本地系统完成标识符解析、AST 校验、Allowlist、只读连接、行数限制、超时、事务和证据绑定。

### 一次性审批

高风险动作统一采用：

```text
Prepare → Exact Preview → One-use Approval
→ Re-resolve → Commit → Append-only Audit
```

审批绑定目标、Provider/MCP、参数、Disclosure、预算、Endpoint 或可执行文件指纹、有效期和单次使用。

### MCP 风险分级

| 等级 | 能力 | 策略 |
|---|---|---|
| R0 | list / inspect | 有界发现 |
| R1 | local resource read | 精确 URI、一次性审批 |
| R2 | pure local tool | 无副作用，可给 Agent |
| R3 | import / snapshot | 展示来源、大小和目标 |
| R4 | external write / export | Preview–Approve–Commit |
| R5 | destructive / finance / identity | 默认禁用或双重审批 |

MCP Server 自报的 Annotation 不能作为安全证明，风险由 BuBu Host 判定。

### Secret 与进程

- Secret 进入 OS Keychain，不进入配置、Prompt 和日志；
- Renderer 不能读取已保存 Secret；
- MCP 不继承主进程环境；
- 禁止 Shell、`npx`、`uvx` 和命令字符串拼接；
- 每个 MCP 独立工作目录和最小环境；
- Local Lock 网络 Deny-by-default；
- Endpoint、参数或 Secret 变化使旧审批失效。

### Prompt Injection

外部内容只能作为数据，不能修改系统规则、披露等级、Tool Registry 和 Policy。工具每轮重新过滤；Tool Result 不能扩大权限；关键安全判断由纯函数 Policy Evaluator 完成。

## 7. 产品特异功能

### Disclosure Lens

将披露预览升级为核心界面，显示 AI 将看到什么、看不到什么、为什么需要、目的地、Token、成本和一次性授权。

> **Before AI sees anything, you see exactly what leaves your device.**

### Local Lock

一键关闭远程 Provider 和远程 MCP，启用本地模型、本地 RAG、网络拒绝和本地安全报告。

### Proof Card

每个结论附带 Dataset Version、Schema Fingerprint、QueryPlan、过滤条件、执行时间、证据、Disclosure、Token 和 Audit ID。

### Replace & Replay

```text
替换新文件 → 检查 Schema Drift → 映射字段
→ 重新验证 → 重放计划 → 更新图表和报告
```

> **第一次做分析，以后只换文件。**

### Dataset Contacts 与 Group Chat

一个数据集是联系人，相关数据集组成群聊。联系人展示版本、质量分数、更新时间、关系和 Workflow；群聊只能访问明确加入的数据集。

### Relationship Map

可视化 Join Key、Cardinality、唯一性、缺失率、版本有效性和 Join 爆炸风险。Agent 提建议，本地内核验证，用户确认。

### Workflow Capsules

将月度销售检查、退款异常、库存缺口、广告归因和数据核对保存为包含输入契约、关系、规则、Plan、报告、触发与审批的业务胶囊。

### Local Business Dictionary

Local RAG 优先支持业务定义，例如净收入、有效客户和新客户。模型找不到定义时必须询问，不能自行发明。

### Why AI?

每次 Agent 调用前可查看“为什么需要 AI，而不是本地代码”。系统无法说明原因时默认不调用模型。

## 8. 竞品启示

- **Excel Copilot**：学习 Ask/Plan/Edit 分离、暂停和撤销；BuBu 对应 Ask、Plan、Run、Automate。
- **Gemini in Sheets**：学习低门槛和快速图表；BuBu 不追在线协作，强调本地敏感数据与重复作业。
- **Quadratic**：学习 MCP、API、Connector 和可审计执行；BuBu 以本地数据内核和权限防火墙形成差异。
- **Equals**：学习“No AI Math”的信任叙事；BuBu进一步强调 No AI SQL Execution。
- **Hex**：Agent 效果取决于 Context、语义规则和评测；BuBu应投资 Context Compiler、Business Dictionary 和 Eval Replay。
- **Julius**：用户先购买快速结果和漂亮 Artifact；BuBu 必须补齐 Report 和首次成功体验。

## 9. 推广体系

### 首页

> **Ask your data. Keep your data.**
>
> Analyze, join, validate, and automate Excel and CSV files locally. Remote models see only the schema, synthetic examples, or aggregates you approve.

中文：

> **问数据，不交数据。**
>
> 在本地分析、关联、校验和自动处理 Excel 与 CSV。远程模型默认看不到原始数据。

首页第二屏只证明三件事：数据留在本地、计算在本地执行、结果可验证并可重复运行。

### 三个核心 Demo

1. **工资表没有交给 AI**：导入 → Disclosure Lens → Typed Plan → 本地执行 → Proof Card。
2. **三张表，不写 VLOOKUP**：客户、订单、退款关系发现和确认。
3. **这个月只替换文件**：Replace & Replay、Schema Drift 和 Workflow 更新。

### 内容主题

- 为什么我不再把客户 CSV 上传到 ChatGPT；
- 三张 Excel 表，不写一次 VLOOKUP；
- 每个月都重做的报表，其实只应该做一次；
- AI 分析数据时究竟看到了什么；
- 为什么省 Token 最好的方法是不给模型数据；
- 本地优先不是离线功能，而是数据权力设计。

### 对比页面

建立 BuBu vs ChatGPT、Excel Copilot、Julius、Quadratic、Power BI。对比原始数据上传、本地模型、披露预览、本地执行、版本、Schema Drift、Workflow、Typed Plan、审计和重复 CSV 作业。

## 10. 路线图

### Phase 1：把技术变成产品

1. 完成 Electron 迁移和 Signed Installer；
2. Report Artifact；
3. 首次导入和首个问题引导；
4. Disclosure Lens；
5. Token Receipt；
6. Replace & Replay 主入口；
7. Proof Card；
8. 3–5 个 Workflow Capsule；
9. 90 秒演示。

### Phase 2：提高正确率与复用

Local Business Dictionary、Local RAG、Context Compiler、Relationship Map、Join Reviewer、更多报告、Schema Drift 影响分析、历史对比和 Eval Replay。

### Phase 3：受控生态

Read-only Database Connector、Google Sheets Connector、R2 Pure Local MCP Tools、Connector SDK、Local Data MCP、Hub、RBAC、Policy Distribution 和企业审计。

## 11. 优先级公式与指标

```text
Feature Priority
= 用户痛苦 × 使用频率 × 本地优势 × 可重复性 × 可验证性 × 付费意愿
  / 开发成本 × 支持成本 × 安全风险 × 认知成本
```

当前最高优先级：Report、Replace & Replay、Proof Card、Disclosure Lens、多表关系和核对。低优先级：完整 Excel 编辑器、大量 MCP、自由多 Agent 对话和在线实时协作。

核心指标：

- 导入后 10 分钟内首个可验证分析比例；
- QueryPlan 本地执行成功率；
- 无来源数字率；
- 真实数据行远程披露数，默认目标 0；
- 每个成功任务 Token 和 Cost；
- Plan Cache 命中率；
- Workflow 重放 Token 降幅；
- Replace & Replay 使用率；
- Workflow 二次运行率；
- 未经批准披露、Raw SQL、MCP 越权和 Secret 日志次数，目标均为 0。

## 12. 最终飞轮

```text
导入数据 → 确认字段语义 → 建立关系 → 保存质量规则
→ AI 提出受限计划 → 本地执行并生成 Proof
→ 保存 Workflow → 下次替换文件 → 自动检查与重放
→ 积累业务词典和历史证据
```

用户使用越久，BuBu 积累的不是聊天记录，而是数据结构、关系、业务定义、质量规则、Workflow、报告模式、策略和可验证历史。

> **BuBu 是一个不需要拿走你的数据，也能持续替你处理数据的本地 AI Agent。**

## 13. 竞品参考

- Microsoft Copilot in Excel: <https://support.microsoft.com/en-us/excel/copilot/get-started-with-copilot-in-excel>
- Google Gemini in Sheets: <https://workspace.google.com/intl/en/resources/spreadsheet-ai/>
- Quadratic AI Spreadsheet and MCP: <https://www.quadratichq.com/>
- Equals Analyst / No AI Math: <https://equals.com/launches/2026/analyst/>
- Hex Data Agent Evaluation: <https://hex.tech/blog/evaluate-data-agents/>
- Julius Privacy and Data Security: <https://julius.ai/docs/get-started/privacy-and-data-security>
