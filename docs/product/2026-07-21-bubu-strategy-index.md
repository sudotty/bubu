# BuBu 本地优先战略文档索引

**状态：** Proposed  
**日期：** 2026-07-21  
**适用范围：** 产品、设计、工程、增长与商业化  

> `PRODUCT_MANIFEST.yaml` 是能力交付状态的唯一事实来源。本文及其关联文档中的 Proposed、Planned、In Progress 能力不得被包装为当前已上线能力。

## 1. 阅读顺序

### 第一份：产品战略

[`2026-07-21-bubu-local-first-product-strategy.md`](./2026-07-21-bubu-local-first-product-strategy.md)

回答以下问题：

- BuBu 属于什么产品品类；
- 为什么不应被定位为 AI Excel；
- 波特五力下应选择什么竞争战略；
- 与 Excel Copilot、Gemini、Quadratic、Equals、Hex 和 Julius 的差异是什么；
- Local Lock、Local Private 和 Controlled Enterprise 分别代表什么；
- 哪些功能构成长期产品壁垒；
- 应如何宣传、定价和建立增长内容。

### 第二份：产品执行手册

[`2026-07-21-bubu-execution-playbook.md`](./2026-07-21-bubu-execution-playbook.md)

回答以下问题：

- 第一阶段优先服务谁；
- 首个高价值产品楔子是什么；
- 如何把一次分析编译为可重复 Workflow；
- 如何减少模型调用和 Token；
- 如何实现 Local Data、Local Intelligence 和 Air-Gapped Local Lock；
- 如何处理披露、审批、MCP、Connector、Prompt Injection 和本地进程风险；
- 未来 90 天应做什么、验证什么、停止什么。

### 第三份：能力事实基线

[`../../PRODUCT_MANIFEST.yaml`](../../PRODUCT_MANIFEST.yaml)

用于确认：

- 哪些能力已经实现；
- 哪些能力仍在开发；
- 哪些能力仅为规划；
- 宣传、演示、文档和销售承诺是否越过当前事实边界。

## 2. 当前统一战略结论

BuBu 的定位是：

> **BuBu — Private AI Data Workspace**
>
> **问数据，不交数据。第一次做分析，以后只换文件。**

BuBu 不与 Excel 竞争完整表格编辑，不与通用模型竞争一次性文件问答，也不以 Agent 数量和 Connector 数量作为核心卖点。

BuBu 首先解决：

> 用户每周或每月收到结构相似的 Excel 或 CSV，需要检查 Schema 变化、关联多张表、执行固定指标和异常检查、生成报告；原始数据不能随意上传，也不应每次重做公式和分析。

产品闭环：

```text
导入本地文件
→ 本地画像与关系确认
→ AI 生成受限 Typed Plan
→ 用户查看精确披露和执行计划
→ 本地 Data Core 校验并执行
→ 生成 Proof Card 和 Report Artifact
→ 保存为 Workflow Capsule
→ 下次替换文件并检查 Schema Drift
→ 无变化时零模型重放
→ 有变化时仅局部调用模型
```

## 3. 六项不可破坏的产品原则

1. **Local Authority**：原始数据、数据版本和计算结果以本地 Data Core 为权威。
2. **Zero-Row by Default**：远程模型默认接收零条原始数据行。
3. **Typed Plans Only**：模型生成 QueryPlan、TransformPlan 或 Workflow Draft，不获得任意 SQL 和任意执行权。
4. **Proof over Prose**：每个关键结论附带数据版本、计划、过滤条件、执行结果、披露和审计证据。
5. **Workflow over Repeated Chat**：成功分析必须能够沉淀为可重放流程，而不是留在聊天记录中。
6. **Model Calls Are Exceptions**：规则、缓存计划和确定性执行能够完成的工作，不调用模型。

## 4. 当前最高优先级

按顺序：

1. Report Artifact；
2. Disclosure Lens；
3. Proof Card；
4. Token Receipt；
5. Replace & Replay 主入口；
6. Schema Drift 影响检查；
7. Workflow Compilation 与 Zero-LLM Replay；
8. 3–5 个 Workflow Capsules；
9. Shadow Run；
10. 首次成功引导与 90 秒演示。

当前不应优先：

- 完整 Excel 编辑器；
- 自由多 Agent 对话；
- 大量低价值 Connector；
- 无明确用户任务的 MCP 扩张；
- 在线多人实时协作；
- 在 Hub、RBAC、Sync 和签名交付未完成前提前销售企业平台能力。

## 5. 宣传口径

主宣传：

> **Ask your data. Keep your data.**

信任证明：

> **AI plans. BuBu calculates. You verify.**

重复作业：

> **Do the work once. Replace the file next month.**

安全边界：

> **No AI Math. No AI SQL Execution. No Raw Rows by Default.**

任何宣传页面都应同时展示：

- 数据是否离开设备；
- 模型看到了什么；
- 计算在哪里执行；
- 答案如何验证；
- 下次如何重复运行。

## 6. 文档维护规则

- 产品战略发生变化时，更新战略文档；
- 执行顺序、指标、威胁模型或 90 天计划变化时，更新执行手册；
- 能力完成状态变化时，只更新 `PRODUCT_MANIFEST.yaml` 及对应实现文档；
- 新宣传内容必须先与 Manifest 对齐；
- 新功能必须说明其对 Activation、Trust、Token Efficiency、Workflow Replay、Retention 或 Revenue 的影响；
- 无法改善上述指标的功能，不应进入高优先级路线图。
