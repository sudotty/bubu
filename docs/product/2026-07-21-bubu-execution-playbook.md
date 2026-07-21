# BuBu 产品执行手册：本地化、低 Token、安全与增长

**状态：** Proposed  
**日期：** 2026-07-21  
**适用范围：** 产品、设计、工程、增长与商业化决策  
**事实约束：** 已交付能力必须以 `PRODUCT_MANIFEST.yaml` 为准。本文件中的目标态、实验和路线图不能被宣传为当前已上线能力。

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
- Schema、Profile、Quality Rule；
- Relationship、Join Cardinality；
- QueryPlan/TransformPlan 校验；
- SQLite 执行、事务、导出和备份；
- Disclosure Envelope 和 Audit。

**最终权威：Go Data Core。**

### 2.2 Intelligence Plane：有限智能层

负责：

- 识别用户意图；
- 选择 Skill；
- 生成 Typed Plan；
- 解释聚合证据；
- 建议字段关系和业务定义；
- 在固定预算内调用纯本地工具。

模型不得决定自己的权限、披露等级、网络、预算或持久化范围。

### 2.3 Control Plane：确定性编排层

负责：

- Workflow 状态机；
- Retry、Timeout、Cancellation、Idempotency；
- Checkpoint 和 Resume；
- Tool Registry 与权限过滤；
- 模型路由、Token Budget 和 Eval；
- Preview、Approval、Commit 与 Audit。

### 2.4 Integration Plane：外部能力层

负责 Connector 和 MCP。任何外部系统都必须经过：

```text
身份解析
→ 能力发现
→ 风险分类
→ 参数验证
→ 数据披露检查
→ 必要审批
→ 有界执行
→ 审计
```

---

## 3. 省 Token：把“少发内容”升级为“少调用模型”

### 3.1 成本目标

Token 优化的主指标不是每次请求字数，而是：

```text
Token Per Successful Task
= 一项业务任务的总输入与输出 Token
  / 最终通过验证的成功任务数
```

同时追踪：

- Model Calls Per Successful Task；
- Workflow Replay Zero-LLM Rate；
- Plan Cache Hit Rate；
- Context Escalation Rate；
- Remote Raw Row Count，默认目标为 0；
- 失败任务浪费 Token。

### 3.2 五级上下文阶梯

模型默认只能从最低级开始：

```text
C0：意图和产品能力目录
C1：Dataset 名称与压缩 Schema
C2：语义类型、Profile、关系和业务词典
C3：本地生成的不可逆合成样例
C4：用户批准的聚合证据
C5：单次批准的具体行
```

模型若需要更多上下文，只能返回结构化 `context_request`：

```json
{
  "reason": "需要确认 order_status 的枚举语义",
  "requested_level": "C2",
  "requested_columns": ["order_status"],
  "maximum_items": 12
}
```

Policy Engine 可以拒绝、缩小或要求用户批准，模型不能自行升级。

### 3.3 Context Compiler

本地将完整目录编译成最小 Schema Digest：

- 数据集稳定 ID 和版本指纹；
- 列名、物理类型、语义类型；
- Null、Unique 和有限安全分位信息；
- 已确认关系和 Cardinality；
- 相关业务定义 ID；
- 允许操作与禁止操作；
- 与当前问题相关的候选列。

禁止默认发送：

- 原始文件路径；
- 全部列；
- 全部聊天历史；
- 真实唯一值和低频组合；
- 已经可以通过 Artifact ID 引用的旧结果；
- 完整 Tool Catalog。

### 3.4 本地候选召回

模型规划前，先由本地代码完成：

```text
用户问题
→ 本地意图分类
→ FTS/Embedding 检索相关 Dataset、列、关系和定义
→ 生成候选上下文
→ 只把 Top-K 候选交给规划模型
```

Local Lock 使用本地 Embedding；Local Private 可允许云 Embedding，但默认不包含原始行。

### 3.5 Model Call Gate

以下操作默认零模型调用：

- 重放已批准 Workflow；
- 同 Schema 新版本运行；
- 修改排序、筛选、图表类型和导出格式；
- 执行已验证 Typed Plan；
- 根据确定性模板重新生成报告；
- 运行质量规则和关系有效性检查；
- 查询已有 Business Dictionary 定义。

只有以下事件才进入模型：

- 新意图无法匹配已验证 Skill/Plan；
- Schema 或关系发生不兼容变化；
- 业务定义冲突或缺失；
- 多个候选计划无法由规则选择；
- 用户请求新的解释或叙事 Artifact。

### 3.6 Plan Cache 与 Workflow Compilation

缓存的是验证通过的计划，不是自然语言答案。

缓存键至少包含：

```text
normalized_intent
+ schema_fingerprint
+ relationship_graph_version
+ business_dictionary_version
+ skill_version
+ privacy_policy_version
+ capability_profile
```

一次成功分析应具备“编译”按钮：

```text
Agent Run
→ Validated Typed Plan
→ Workflow Definition
→ 输入契约与漂移策略
→ 报告模板
→ 未来零模型或局部模型重放
```

### 3.7 模型分层

- **规则/代码**：已知意图、已存在计划、格式校验；
- **本地小模型**：Router、字段语义匹配、短文本分类；
- **中等模型**：新 QueryPlan、JoinPlan、TransformPlan；
- **强模型**：复杂多步骤规划、冲突解决、长报告；
- **Reviewer**：仅高风险、低置信度或高价值任务启用。

不能因为用户购买了更强模型，就让所有请求默认使用最贵模型。

### 3.8 Token Receipt

每次调用显示并保存：

```text
调用原因：新关系无法由规则确定
远程模型调用：1 次
输入 Token：1,842
输出 Token：623
真实数据行：0
Schema 字段：14
合成样例：3
批准聚合：0
预计/实际成本
缓存状态
Audit ID
```

Token Receipt 同时承担三种价值：成本证明、隐私证明和系统可观测性。

---

## 4. 彻底本地化：三个可证明等级

“本地优先”不能只是一句宣传语，必须形成可检测、可导出的运行等级。

### L1：Local Data

- 原始文件、数据库、Query Execution 和 Artifact 在本地；
- 可使用远程模型；
- 远程模型只接收允许的 Disclosure Envelope；
- 适合默认个人版。

### L2：Local Intelligence

- 本地模型、Embedding、Reranker 和本地 RAG；
- 无远程 Provider；
- 可选本地只读 MCP；
- 所有 AI 请求均在设备内完成。

### L3：Air-Gapped Local Lock

- 网络 Deny-by-default；
- 无远程 Provider、Hub、遥测和远程 MCP；
- 模型、Skill、更新和规则通过离线签名包导入；
- 备份、恢复、诊断和审计全部离线；
- 生成可验证的 Local Lock 状态报告。

### 本地化证明页

设置页应显示：

- 当前运行等级；
- 已启用 Provider 和 Endpoint；
- 网络允许列表；
- 本地模型和哈希；
- MCP 连接及权限；
- 最近远程调用；
- 最近披露等级；
- 是否存在未完成 Audit；
- 一键导出不含用户数据的安全报告。

宣传必须区分“当前可用”和“目标态”。在签名安装包、本地 RAG 和完整网络策略完成前，不得宣称完整 L3 已交付。

---

## 5. 安全：把威胁模型变成用户可见产品

### 5.1 主要威胁

1. **Spreadsheet Prompt Injection**：单元格、列名或导入文本包含诱导模型越权的指令。
2. **CSV/Formula Injection**：导出内容在 Excel 中触发公式或外部链接。
3. **Model Exfiltration**：Prompt 意外包含真实行、Secret、路径或历史内容。
4. **MCP Server Abuse**：恶意 Server 伪装为只读工具，访问本地文件或网络。
5. **Connector Overreach**：Connector 获得超出当前任务所需的数据范围。
6. **Join Explosion**：错误关系导致重复行和错误结论。
7. **Schema Drift Misbinding**：新文件字段被错误映射到旧流程。
8. **Audit Gap**：任务执行成功，但披露、审批或结果不能完整关联。
9. **Backup Leakage**：备份包含明文凭据、临时文件或无边界数据。
10. **Local Process Compromise**：Renderer、AI Utility 或第三方可执行程序扩大权限。

### 5.2 不可信输入原则

以下内容全部标记为 Untrusted Data：

- 单元格、列名、文件名；
- 文档和业务定义；
- MCP Server 描述、Prompt 和 Resource；
- Connector 返回内容；
- 模型输出和 Tool Result；
- 外部错误信息。

它们不能修改：

- System Policy；
- Disclosure Level；
- Tool Registry；
- Approval Requirement；
- Network Policy；
- Token/Time Budget；
- Secret Scope。

### 5.3 执行安全

模型只能输出严格的 Typed Plan。本地系统负责：

- JSON Schema 拒绝额外字段；
- Identifier Resolution；
- SQL AST Allowlist；
- Read-only Connection；
- Join Cardinality 检查；
- Row、Time、Memory 和 Result Budget；
- 事务与新版本写入；
- 证据单元格/结果行绑定；
- 失败回滚和 Checkpoint。

### 5.4 一次性能力审批

高风险动作采用：

```text
Prepare
→ Exact Preview
→ One-use Approval
→ Re-resolve Current State
→ Execute
→ Append-only Audit
```

审批必须绑定：

- 目标和用户意图；
- Provider/MCP/Connector 身份；
- Endpoint、Executable、参数和环境指纹；
- 输入与输出 Disclosure；
- Tool、预算、有效期；
- 数据集版本和 Schema Fingerprint。

任何变化都使旧审批失效。

### 5.5 MCP 分级开放

| 等级 | 示例 | 默认策略 |
|---|---|---|
| R0 | list/inspect | 有界发现，不进入模型 |
| R1 | local resource read | 精确 URI、大小限制、一次性审批 |
| R2 | pure local calculation | 可给有限 Agent，严格输入输出 |
| R3 | import/snapshot | 预览来源、范围、大小和目标 |
| R4 | export/external write | Preview–Approve–Commit |
| R5 | destructive/identity/finance | 默认禁用或双重审批 |

MCP Annotation 只用于展示，不能作为风险证明。风险分类由 BuBu Host 的本地 Policy 决定。

---

## 6. 应重点产品化的特异功能

### 6.1 Disclosure Lens

在模型调用前清楚显示：

- AI 将看到什么；
- AI 不会看到什么；
- 为什么本次需要 AI；
- 数据目的地；
- Token 和成本；
- 审批有效期和使用次数。

> **Before AI sees anything, you see exactly what leaves your device.**

### 6.2 Zero-Row Guarantee

为默认模式提供可验证标识：

> **0 raw rows sent to remote AI.**

当任务必须使用 Explicit Rows 时，标识立即变化并要求单独批准，不能静默降级。

### 6.3 Proof Card

每个结论附带：

- Dataset Version；
- Schema Fingerprint；
- QueryPlan/TransformPlan；
- 过滤、Join 和聚合；
- 本地执行时间；
- 结果证据；
- Disclosure、Token 和 Audit ID；
- 失效条件。

### 6.4 Replace & Replay

将“替换新文件”放在首页主入口：

```text
替换文件
→ Schema Drift
→ 安全映射
→ 关系和规则复验
→ 重放 Workflow
→ 更新报告
```

核心文案：

> **第一次做分析，以后只换文件。**

### 6.5 Workflow Capsules

一次成功分析可保存为业务胶囊：

- 月度销售报告；
- 退款异常检查；
- 客户与订单核对；
- 库存缺口；
- 广告渠道归因；
- 发票与回款对账。

Capsule 包含输入契约、关系、规则、计划、报告、触发、审批和失败策略。

### 6.6 Local Business Dictionary

本地维护：

- KPI 定义；
- 同义词；
- 字段语义；
- 允许的计算方式；
- 负责人和版本；
- 适用数据集。

模型缺少定义时必须询问或返回 `definition_gap`，不能自行发明。

### 6.7 Change Impact Graph

当 Schema、关系或业务定义变化时，展示受影响的：

- Workflow；
- QueryPlan；
- Quality Rule；
- Report；
- Dataset Group；
- Scheduled Trigger。

用户可以先修复影响，再运行，避免错误静默传播。

### 6.8 Shadow Run

新 Workflow 首次运行时允许与旧人工结果或旧公式并行比较：

- 指标差异；
- 行数差异；
- 未匹配项；
- 运行时间；
- Token 和成本。

通过 Shadow Run 后才允许自动触发，降低业务采用风险。

### 6.9 Local Data Inbox

用户指定一个本地目录作为数据收件箱：

- 新文件只在本地被发现；
- 自动匹配 Dataset；
- 先执行 Schema 和安全检查；
- 仅在用户批准后替换或触发 Workflow。

不应默认后台上传或自动执行有副作用任务。

---

## 7. 竞争策略：不追平功能，建立信任型类别

### 7.1 竞争分层

| 类别 | 代表 | 优势 | BuBu 不应正面追赶 | BuBu 的反定位 |
|---|---|---|---|---|
| 原生办公 AI | Excel Copilot、Gemini Sheets | 分发、编辑、协作 | 完整 Spreadsheet 兼容 | 本地权威、透明披露、重复文件工作 |
| 上传式分析 | Julius、通用模型 | 首次结果快 | 上传聊天体验 | Zero-Row、Proof、Workflow 编译 |
| AI Spreadsheet | Quadratic、Equals | 公式、代码、MCP、协作 | 无限画布和云表格 | 本地数据内核、版本、关系、审批 |
| 企业分析 Agent | Hex 等 | 语义层、数仓、评测 | 企业云数仓全覆盖 | SMB/顾问本地文件与低部署成本 |

### 7.2 必须学习的能力

- Excel Copilot：Ask/Plan/Edit 的交互分层和可暂停执行；
- Gemini Sheets：低门槛图表、多表任务和 Workspace 分发；
- Quadratic：代码可验证、MCP/API 生态和 Agent 可操作 Artifact；
- Equals：No AI Math 和垂直 GTM 分析；
- Hex：Context Studio、语义定义、Agent Observability 和 Eval Lab；
- Julius：首次成功速度和漂亮结果 Artifact。

### 7.3 不可复制的壁垒栈

```text
Local Runtime
+ Privacy Gateway
+ Dataset Versions
+ Relationship Graph
+ Business Dictionary
+ Validated Workflow Library
+ Proof/Audit History
+ Local/Cloud Model Neutrality
```

Prompt、模型名称和自然语言转 SQL 不是长期壁垒。

---

## 8. 推广：先证明，再解释

### 8.1 信息层级

推广顺序必须是：

```text
隐私钩子
→ 现场证明
→ 正确性证据
→ 重复作业价值
→ 技术架构
```

不要先向普通用户讲 MCP、Agent Loop 和 AST。

### 8.2 首页结构

第一屏：

> **Ask your data. Keep your data.**
>
> **问数据，不交数据。**

第二屏：用动画证明数据流。

```text
Raw rows stay local
→ AI receives a reviewed schema package
→ BuBu executes locally
→ Every answer includes proof
```

第三屏：Replace & Replay。

> Build the analysis once. Replace the file next month.

第四屏：三种本地化等级与当前产品支持范围。

### 8.3 三个英雄 Demo

1. **工资表没有交给 AI**：展示 0 Raw Rows、Disclosure Lens、Typed Plan 和 Proof Card。
2. **三张 CSV，不写 VLOOKUP**：客户、订单、退款关系确认和本地 Join。
3. **本月只替换文件**：Schema Drift、影响检查、零 AI Workflow 重放和报告更新。

### 8.4 内容漏斗

认知内容：

- 为什么不要随手把客户 CSV 上传到 AI；
- AI 分析数据时究竟看到了什么；
- 省 Token 最好的办法不是压缩，而是不发送数据。

问题解决内容：

- 三张表不用 VLOOKUP；
- 每月报表为什么只应做一次；
- 如何在本地检查客户、订单和退款差异。

转化内容：

- 90 秒真实演示；
- 与 ChatGPT、Excel Copilot、Quadratic、Julius 的边界对比；
- 可下载的 Workflow Capsule；
- Local Lock 安全说明。

### 8.5 信任内容

公开以下材料比发布空泛隐私口号更有效：

- Privacy Architecture；
- Threat Model；
- Disclosure 示例；
- Token Receipt 示例；
- Local Lock 状态页；
- 性能基线；
- 已知限制；
- `PRODUCT_MANIFEST.yaml` 对应的能力状态。

---

## 9. 包装与定价假设

### Free

- 本地 CSV/XLSX；
- 基础 Schema/Profile；
- 有限数据集；
- 本地查询；
- BYOK/本地模型；
- 1 个 Workflow Capsule。

### Pro

核心付费点：

- 无限本地数据集和 Group；
- Replace & Replay；
- 多表关系；
- Proof Card；
- Workflow 与触发；
- 报告 Artifact；
- Backup/Restore；
- 高级模型路由和 Token Receipt。

### Analyst

- Database Read-only Connector；
- Local Business Dictionary；
- Local RAG；
- Change Impact Graph；
- Shadow Run；
- 高级 Workflow Capsule；
- MCP R2 能力。

### Team/Enterprise

必须等待 Hub、RBAC、Policy Distribution、企业审计、签名部署和支持流程达到交付标准后再销售，不能只靠路线图提前命名企业版。

---

## 10. 90 天执行计划

### Days 1–30：完成首次价值闭环

目标：用户导入文件后十分钟内得到一个有 Proof 的结果。

优先：

1. 完成 Report Artifact 最小版本；
2. Disclosure Lens 产品化；
3. Proof Card；
4. Token Receipt；
5. 首次导入与问题引导；
6. 90 秒 Demo 数据集和脚本；
7. 明确 Local Data 当前保证。

验收：

- 首次成功率；
- 首个 Proof 生成时间；
- 披露预览理解率；
- Raw Row Remote Disclosure = 0（默认流程）。

### Days 31–60：形成重复作业闭环

目标：证明下个月不再重新做。

优先：

1. Replace & Replay 首页入口；
2. Workflow 编译体验；
3. Schema Drift 影响检查；
4. 3 个 Workflow Capsules；
5. Replay Zero-LLM 路径；
6. Shadow Run 最小版。

验收：

- Workflow 二次运行率；
- Replay Token 降幅；
- Schema Drift 正确阻断率；
- 用户手工修改次数下降。

### Days 61–90：建立知识与增长闭环

目标：提高正确率、复用率和可传播性。

优先：

1. Local Business Dictionary 最小版；
2. Context Compiler 与候选列检索；
3. Change Impact Graph 最小版；
4. 对比页面和英雄 Demo；
5. Privacy/Threat Model 页面；
6. 定价实验与用户访谈；
7. 本地模型性能矩阵。

验收：

- QueryPlan 成功率；
- Plan Cache 命中率；
- Token Per Successful Task；
- 二周/四周留存；
- Demo 到下载转化率。

---

## 11. 决策框架

任何新功能必须通过以下问题：

1. 是否解决目标用户每周或每月重复发生的问题？
2. 是否利用了本地数据和本地执行优势？
3. 是否可以形成可验证 Artifact？
4. 是否能够编译为 Workflow 或增强已有 Workflow？
5. 是否减少模型调用、Token 或人工重复劳动？
6. 是否增加数据、权限或支持风险？
7. 能否在 90 秒 Demo 中被普通用户理解？
8. 用户是否愿意为结果持续付费？

优先级：

```text
Priority
= Pain × Frequency × Local Advantage × Repeatability
  × Verifiability × Revenue Potential
  / (Engineering Cost × Security Risk × Support Cost × Cognitive Load)
```

当前高优先级：

- Report Artifact；
- Disclosure Lens；
- Proof Card；
- Replace & Replay；
- Workflow Compilation；
- Token Receipt；
- Business Dictionary。

当前低优先级：

- 完整 Excel 编辑器；
- 大量泛 Connector；
- 自由多 Agent 对话；
- 无边界 MCP Tool Execution；
- 在线多人实时协作；
- 仅为了展示技术而存在的 Agent 数量。

---

## 12. 核心指标与停止条件

### Activation

- 导入后 10 分钟内首个验证结果比例；
- 首个 QueryPlan 批准率；
- 首个 Proof Card 查看率。

### Trust

- 未经批准披露次数：0；
- Raw SQL 执行次数：0；
- Secret 进入日志次数：0；
- MCP 越权次数：0；
- 无证据数字率；
- Schema Drift 错误重放率。

### Efficiency

- Token Per Successful Task；
- Model Calls Per Successful Task；
- Zero-LLM Replay Rate；
- Plan Cache Hit Rate；
- P95 本地查询时间。

### Retention

- Replace & Replay 使用率；
- Workflow 二次、三次运行率；
- Dataset Version 月增长；
- Business Dictionary 复用次数；
- 4 周留存。

### 停止条件

以下功能若连续实验不能改善激活、信任、效率或留存，应停止扩张：

- 新 Agent 角色；
- 新 Connector；
- 新图表类型；
- 新模型 Provider；
- 泛化企业功能。

---

## 13. 最终产品飞轮

```text
导入本地数据
→ 确认 Schema 与业务语义
→ 建立关系和质量规则
→ AI 生成最小受限计划
→ 本地执行并产生 Proof
→ 编译为 Workflow Capsule
→ 新文件到达后检查漂移
→ 零 AI 或局部 AI 重放
→ 积累业务定义、关系和验证历史
```

用户使用越久，BuBu 的价值不来自聊天记忆，而来自：

- 数据结构记忆；
- 关系记忆；
- 业务定义；
- 质量规则；
- 已验证计划；
- 可重放 Workflow；
- 证据与审计历史。

最终产品承诺：

> **BuBu 不需要拿走你的数据，也能持续替你完成数据工作。**

---

## 14. 竞品与设计参考

- Microsoft Copilot in Excel：<https://support.microsoft.com/en-us/copilot-excel>
- Gemini in Google Sheets：<https://workspace.google.com/intl/en/resources/spreadsheet-ai/>
- Quadratic AI Spreadsheet / MCP：<https://www.quadratichq.com/>
- Equals Analyst / No AI Math：<https://equals.com/launches/2026/analyst/>
- Hex Context Studio：<https://hex.tech/product/context-studio/>
- Hex Agent Evaluation：<https://hex.tech/blog/evaluate-data-agents/>
- Julius AI：<https://julius.ai/>
