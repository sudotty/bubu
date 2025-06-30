# Excel自然语言/SQL处理工具 - UI设计文档

## 设计概述

本文档描述了基于自然语言和SQL处理的Excel数据处理工具的UI设计。产品通过自然语言输入、数据流可视化和结果分享三个核心界面，为用户提供智能化、简洁的Excel数据处理体验。

## 设计原则

### 1. 自然语言优先
- **对话式交互**：用自然语言描述需求，降低技术门槛
- **智能理解**：系统自动解析用户意图，生成对应的SQL查询
- **学习友好**：显示生成的SQL语句，帮助用户理解和学习

### 2. 极简MVP设计
- **核心功能聚焦**：专注于Excel→SQL→结果的核心流程
- **避免过度设计**：不做复杂的拖拽编排，保持界面简洁
- **快速上手**：新用户能在3分钟内完成第一个数据查询

### 3. 预留扩展能力
- **P2P分享预留**：为数据结果的点对点分享预留UI空间
- **LLM增强预留**：为AI自动生成SQL功能预留交互设计
- **模块化架构**：支持后续功能的无缝集成

### 4. 深色模式优先
- **主色调**：深灰色背景 (#1a1a1a)
- **强调色**：蓝色系 (#3b82f6) 用于按钮和链接
- **文本色**：浅灰色 (#e5e7eb) 确保可读性
- **边框色**：中灰色 (#374151) 用于分割线
- **状态区分**：通过颜色变化清晰表示执行状态

## 技术栈

### 前端技术
- **框架**：React 18 + TypeScript
- **状态管理**：Zustand（轻量级状态管理）
- **UI组件库**：Ant Design 5.x（企业级UI组件）
- **图表库**：ECharts（数据可视化）
- **样式方案**：Tailwind CSS + CSS Modules
- **P2P预留**：为IPFS或Golang P2P技术预留前端接口

### 后端技术
- **框架**：Go + Gin（高性能Web框架）
- **数据库**：SQLite（Excel数据自动转换）
- **文件处理**：excelize（Excel文件解析）
- **API设计**：RESTful API + WebSocket（实时通信）
- **LLM预留**：为火山引擎LLM API调用预留接口

## 界面布局

### 整体布局结构（自然语言优先三栏式）
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TopToolbar                                       │
├─────────────────┬─────────────────────────┬─────────────────────────────────┤
│                 │                         │                                 │
│   LeftPanel     │     MainWorkArea        │        RightPanel               │
│                 │                         │                                 │
│ ┌─────────────┐ │ ┌─────────────────────┐ │ ┌─────────────────────────────┐ │
│ │ 📂 文件管理  │ │ │   自然语言输入区     │ │ │      SQL查询区              │ │
│ └─────────────┘ │ │  "查找销售额最高的..." │ │ │ ┌─────────────────────────┐ │ │
│ ┌─────────────┐ │ └─────────────────────┘ │ │ │ SELECT * FROM sales     │ │ │
│ │ 📝 历史记录  │ │ ┌─────────────────────┐ │ │ │ WHERE amount > 1000     │ │ │
│ │ ├─ 查询历史  │ │ │   数据流可视化区     │ │ │ │ ORDER BY amount DESC    │ │ │
│ │ ├─ 数据流程  │ │ │  Excel → SQLite →   │ │ │ └─────────────────────────┘ │ │
│ └─────────────┘ │ │  自然语言 → SQL →   │ │ │ ┌─────────────────────────┐ │ │
│ ┌─────────────┐ │ │  结果展示           │ │ │ │      结果预览区          │ │ │
│ │ 🔗 P2P分享   │ │ └─────────────────────┘ │ │ │ ┌─────┬─────┬─────┬───┐ │ │ │
│ │ (预留功能)   │ │ ┌─────────────────────┐ │ │ │ │ID   │姓名 │销售额│...│ │ │ │
│ │ ├─ 我的分享  │ │ │   执行状态监控区     │ │ │ │ ├─────┼─────┼─────┼───┤ │ │ │
│ │ ├─ 团队分享  │ │ │  ✅ Excel文件已解析  │ │ │ │ │001  │张三 │15000│...│ │ │ │
│ └─────────────┘ │ │  ⏳ 正在生成SQL      │ │ │ │ └─────┴─────┴─────┴───┘ │ │ │
│                 │ │  ⏸️ 等待用户确认     │ │ │ └─────────────────────────┘ │ │
│                 │ └─────────────────────┘ │ │ ┌─────────────────────────┐ │ │
│                 │                         │ │ │    分享管理区(预留)      │ │ │
│                 │                         │ │ │ P2P分享、权限管理等     │ │ │
│                 │                         │ │ └─────────────────────────┘ │ │
└─────────────────┴─────────────────────────┴─────────────────────────────────┘
```

### TopToolbar（顶部工具栏）
- **位置**: 固定在顶部
- **高度**: 64px
- **功能**:
  - Logo 和产品名称
  - 快速操作按钮（单组件执行、流程执行、新建流程）
  - 文件操作（导入、导出、保存流程）
  - 用户设置和帮助
  - 主题切换

### LeftPanel（左侧面板）
- **位置**: 左侧固定
- **宽度**: 320px（可调整）
- **功能**:
  - **文件管理区**:
    - 文件树展示
    - 文件上传拖拽区
    - 最近使用文件
    - 文件搜索和筛选
  - **组件库**:
    - Excel基础组件（VLOOKUP、数据透视表、条件格式等）
    - 业务组件（销售分析、财务报表、人事统计等）
    - 自定义组件
    - 组件搜索和分类
  - **流程中心**:
    - 预置业务流程
    - 我的自定义流程
    - 团队共享流程
    - 流程模板库

### MainWorkArea（主工作区）
- **位置**: 中间主要区域
- **功能**:
  - **自然语言输入区域**:
    - 大型文本输入框，支持多行输入
    - 自动补全和智能提示功能
    - 历史输入记录快速选择
    - 示例提示和语音输入支持
  - **数据流可视化区域**:
    - Excel→SQLite→自然语言→SQL→结果的流程图
    - 每个步骤的状态可视化和数据量统计
    - SQL生成过程的实时显示
  - **执行状态监控区域**:
    - 实时执行进度和状态反馈
    - 错误提示和调试信息
    - LLM增强功能预留区域
    - 执行日志和性能统计

### RightPanel（右侧面板）
- **位置**: 右侧固定
- **宽度**: 360px（可调整）
- **功能**:
  - **SQL查询区**:
    - 自动生成的SQL查询语句显示
    - 语法高亮和格式化
    - 支持用户手动编辑和优化
    - SQL语法检查和错误提示
  - **结果预览区**:
    - 实时数据预览
    - 结果格式化显示
    - 数据质量检查
    - 导出选项
  - **分享管理区（预留功能）**:
    - P2P分享控制和权限设置
    - 团队分享中心
    - 分享状态监控
    - P2P网络连接状态

**文件模式界面**：
```
┌─────────────────────────┐
│ [文件] [表格]           │
├─────────────────────────┤
│ 🔍 搜索文件...          │
├─────────────────────────┤
│ 📌 置顶文件             │
│   📊 m1.xlsx           │
│   📊 f1.xlsx           │
├─────────────────────────┤
│ 📅 今天                │
│   📄 c1.csv            │
│   📄 d1.csv            │
├─────────────────────────┤
│ 📅 昨天                │
│   📊 sales_data.xlsx   │
└─────────────────────────┘
```

### 3. QueryPanel (右侧查询面板)
**功能**：
- 自然语言/SQL双模式查询
- 查询历史管理
- 结果表格展示
- 图表可视化
- 数据导出

**设计要点**：
- 上下分区：输入区 + 结果区
- Monaco编辑器提供专业SQL编辑体验
- 结果表格支持排序、筛选、分页
- 响应式设计，适配不同屏幕

**查询界面布局**：
```
┌─────────────────────────────────────────┐
│ [自然语言] [SQL]  [历史] [设置]          │
├─────────────────────────────────────────┤
│                                         │
│  查询输入区 (Monaco Editor)              │
│  SELECT * FROM m1 WHERE...              │
│                                         │
├─────────────────────────────────────────┤
│ 结果: 1000条记录 [导出] [图表] [保存]     │
├─────────────────────────────────────────┤
│                                         │
│           结果表格展示区                 │
│  ┌─────┬─────┬─────┬─────┬─────┐        │
│  │ ID  │姓名 │部门 │续保率│...  │        │
│  ├─────┼─────┼─────┼─────┼─────┤        │
│  │ 001 │张三 │销售 │85%  │...  │        │
│  └─────┴─────┴─────┴─────┴─────┘        │
│                                         │
└─────────────────────────────────────────┘
```

### 4. DAGPanel (自动化流程编辑面板)
**功能**：
- 可视化业务流程编排
- 拖拽式节点创建
- 流程模板管理
- 一键执行流程

**设计要点**：
- 使用ReactFlow组件
- 左侧节点面板 + 右侧画布
- 节点类型：数据导入、数据清洗、数据关联、业务查询
- 流程执行状态可视化

## 组件设计规范

### 1. 组件节点设计
**基础组件节点**：
```
┌─────────────────────────┐
│ 🔧 VLOOKUP              │
│ ─────────────────────── │
│ 查找列: 员工ID           │
│ 返回列: 姓名             │
│ 状态: ✅ 已完成          │
└─────────────────────────┘
```

**业务组件节点**：
```
┌─────────────────────────┐
│ 📊 销售业绩排名          │
│ ─────────────────────── │
│ 排序字段: 销售额         │
│ 排序方式: 降序           │
│ 状态: ⏳ 执行中          │
└─────────────────────────┘
```

### 2. 流程连线设计
- **数据流向**: 实线箭头，表示数据传递
- **控制流向**: 虚线箭头，表示执行顺序
- **错误流向**: 红色虚线，表示错误处理
- **条件分支**: 菱形节点，支持条件判断

### 3. 状态指示器
- **等待执行**: ⏸️ 灰色
- **执行中**: ⏳ 蓝色动画
- **执行成功**: ✅ 绿色
- **执行失败**: ❌ 红色
- **警告**: ⚠️ 黄色

### 4. 参数配置面板
**智能参数推荐**：
```
┌─────────────────────────────┐
│ 组件名称: VLOOKUP            │
├─────────────────────────────┤
│ 查找列: [员工ID ▼]           │
│ 💡 推荐: 员工ID, 工号        │
├─────────────────────────────┤
│ 返回列: [姓名 ▼]             │
│ 💡 推荐: 姓名, 部门, 职位    │
├─────────────────────────────┤
│ 匹配方式: [精确匹配 ▼]       │
└─────────────────────────────┘
```

### 5. 颜色系统 (基于daisyUI dark主题)
```css
/* 主要颜色 */
--primary: #3b82f6;      /* 蓝色 - 主要按钮、链接 */
--secondary: #6b7280;    /* 灰色 - 次要元素 */
--accent: #10b981;       /* 绿色 - 成功状态 */
--warning: #f59e0b;      /* 橙色 - 警告状态 */
--error: #ef4444;        /* 红色 - 错误状态 */

/* 组件状态颜色 */
--component-idle: #6b7280;      /* 灰色 - 等待执行 */
--component-running: #3b82f6;   /* 蓝色 - 执行中 */
--component-success: #10b981;   /* 绿色 - 执行成功 */
--component-error: #ef4444;     /* 红色 - 执行失败 */
--component-warning: #f59e0b;   /* 黄色 - 警告 */

/* 流程连线颜色 */
--flow-data: #3b82f6;           /* 蓝色 - 数据流 */
--flow-control: #64748b;        /* 灰色 - 控制流 */
--flow-error: #ef4444;          /* 红色 - 错误流 */

/* 背景颜色 */
--base-100: #1a1a1a;     /* 主背景 */
--base-200: #2d2d2d;     /* 面板背景 */
--base-300: #404040;     /* 边框颜色 */
--canvas-bg: #111827;    /* 流程设计画布背景 */

/* 文本颜色 */
--base-content: #e5e7eb; /* 主要文本 */
--neutral: #9ca3af;      /* 次要文本 */
```

### 2. 字体系统
```css
/* 字体大小 */
--text-xs: 0.75rem;      /* 12px - 标签、提示 */
--text-sm: 0.875rem;     /* 14px - 正文 */
--text-base: 1rem;       /* 16px - 标准文本 */
--text-lg: 1.125rem;     /* 18px - 小标题 */
--text-xl: 1.25rem;      /* 20px - 标题 */

/* 字体权重 */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 3. 间距系统
```css
/* 内边距 */
--spacing-1: 0.25rem;    /* 4px */
--spacing-2: 0.5rem;     /* 8px */
--spacing-3: 0.75rem;    /* 12px */
--spacing-4: 1rem;       /* 16px */
--spacing-6: 1.5rem;     /* 24px */
--spacing-8: 2rem;       /* 32px */

/* 组件间距 */
--gap-sm: 0.5rem;        /* 8px - 小间距 */
--gap-md: 1rem;          /* 16px - 中等间距 */
--gap-lg: 1.5rem;        /* 24px - 大间距 */
```

### 4. 圆角和阴影
```css
/* 圆角 */
--rounded-sm: 0.125rem;  /* 2px - 小圆角 */
--rounded: 0.25rem;      /* 4px - 标准圆角 */
--rounded-md: 0.375rem;  /* 6px - 中等圆角 */
--rounded-lg: 0.5rem;    /* 8px - 大圆角 */

/* 阴影 */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

## 响应式设计

### 断点系统
```css
/* 移动设备 */
@media (max-width: 768px) {
  /* 左侧面板收起为抽屉模式 */
  /* 查询面板占满屏幕 */
}

/* 平板设备 */
@media (min-width: 768px) and (max-width: 1024px) {
  /* 左侧面板宽度调整为240px */
  /* 保持左右分栏布局 */
}

/* 桌面设备 */
@media (min-width: 1024px) {
  /* 标准320px左侧面板 */
  /* 完整功能展示 */
}
```

### 移动端适配
- 左侧文件面板改为抽屉模式
- 顶部工具栏简化为汉堡菜单
- 查询输入区支持触摸操作
- 结果表格支持横向滚动

## 交互设计

### 组件操作
1. **组件拖拽**
   - 从组件库拖拽到画布
   - 拖拽过程中显示可放置区域
   - 自动对齐和吸附
   - 拖拽预览效果

2. **组件配置**
   - 点击组件显示参数面板
   - 智能参数推荐
   - 实时参数验证
   - 批量参数设置

3. **组件连接**
   - 鼠标悬停显示连接点
   - 拖拽连线创建数据流
   - 智能连接提示
   - 连线类型自动识别

### 流程操作
1. **流程设计**
   - 可视化流程编辑器
   - 多选组件批量操作
   - 流程模板应用
   - 流程版本管理

2. **流程执行**
   - 一键执行整个流程
   - 单步调试模式
   - 实时执行监控
   - 执行结果预览

3. **流程管理**
   - 流程保存和加载
   - 流程分享和导入
   - 流程性能分析
   - 流程模板创建

### 文件操作
1. **文件上传**
   - 支持拖拽上传
   - 支持多文件选择
   - 实时上传进度显示
   - 文件格式验证和智能识别

2. **文件管理**
   - 文件树形结构展示
   - 文件搜索和筛选
   - 文件预览功能
   - 文件关联分析

### 状态反馈
1. **组件状态**
   - 等待执行：灰色图标，静态显示
   - 执行中：蓝色图标，动画效果
   - 执行成功：绿色图标，成功提示
   - 执行失败：红色图标，错误详情
   - 警告状态：黄色图标，警告信息

2. **流程状态**
   - 流程进度条显示整体执行进度
   - 当前执行节点高亮显示
   - 执行时间和性能统计
   - 错误节点自动定位和提示

3. **操作反馈**
   - 参数验证实时提示
   - 文件上传进度显示
   - 操作成功/失败 Toast 提示
   - 长时间操作显示取消按钮

## 性能优化

### 组件系统优化
1. **组件懒加载**
   - 组件库按需加载
   - 大型业务组件动态导入
   - 流程模板延迟加载

2. **组件渲染优化**
   - 使用React.memo优化组件重渲染
   - 虚拟化大型组件列表
   - 组件状态局部化管理

3. **流程执行优化**
   - 并行执行无依赖组件
   - 流程执行结果缓存
   - 增量数据处理

### 画布性能优化
1. **渲染优化**
   - Canvas虚拟化渲染
   - 节点可见性检测
   - 连线路径优化算法

2. **交互优化**
   - 拖拽操作防抖
   - 批量更新减少重绘
   - 智能碰撞检测

### 数据处理优化
1. **内存管理**
   - 大文件分块处理
   - 中间结果及时释放
   - 数据流式处理

2. **缓存策略**
   - 组件执行结果缓存
   - 文件解析结果缓存
   - 智能推荐结果缓存

## 可访问性

### 键盘导航
- 组件库和流程画布支持Tab键导航
- 流程节点支持方向键移动
- 自定义快捷键（Ctrl+S保存流程，Ctrl+R执行流程）
- 焦点状态在组件和连线上清晰可见
- 参数配置面板逻辑导航顺序

### 屏幕阅读器
- 组件节点语义化描述
- 流程执行状态ARIA实时更新
- 参数配置表单完整标签
- 执行结果表格标题和描述
- 错误信息和警告的无障碍提示

### 视觉辅助
- 组件状态不仅依赖颜色，还有图标和文字
- 流程连线支持高对比度模式
- 文本对比度符合WCAG 2.1 AA标准
- 支持放大缩小而不影响功能
- 动画效果可关闭选项

## 开发规范

### 1. 组件命名
```typescript
// 组件文件命名：PascalCase
ComponentLibrary.tsx
WorkflowDesigner.tsx
ParameterPanel.tsx
FlowNode.tsx

// 业务组件命名
VLookupComponent.tsx
SalesAnalysisComponent.tsx
DataPivotComponent.tsx

// 组件内部命名
const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ ... }) => {
  // hooks命名：camelCase
  const [components, setComponents] = useState<ComponentDefinition[]>([]);
  
  // 事件处理函数：handle + 动作
  const handleComponentDrag = () => { ... };
  
  return (
    <div className="component-library">
      {/* JSX内容 */}
    </div>
  );
};
```

### 2. CSS类命名
```css
/* 使用Tailwind CSS原子类 */
<div className="bg-canvas-bg text-base-content p-4 rounded-lg shadow-md">

/* 自定义类使用BEM命名 */
.component-library {}
.component-library__category {}
.component-library__item {}
.component-library__item--dragging {}

.flow-node {}
.flow-node__header {}
.flow-node__content {}
.flow-node__status {}
.flow-node__status--running {}
.flow-node__status--success {}
.flow-node__status--error {}
```

### 3. TypeScript类型
```typescript
// 组件相关类型
interface ComponentLibraryProps {
  components: ComponentDefinition[];
  onComponentDrag: (component: ComponentDefinition) => void;
}

interface FlowNodeProps {
  node: FlowNode;
  status: ComponentStatus;
  onParameterChange: (params: ComponentParameters) => void;
}

// 流程相关类型
type ComponentStatus = 'idle' | 'running' | 'success' | 'error' | 'warning';
type FlowConnectionType = 'data' | 'control' | 'error';
type ComponentCategory = 'excel' | 'business' | 'custom';

// 业务类型
interface ComponentDefinition {
  id: string;
  name: string;
  category: ComponentCategory;
  icon: string;
  description: string;
  parameters: ParameterDefinition[];
}

interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: ComponentData;
  status: ComponentStatus;
}
```

## 测试策略

### 1. 单元测试
```typescript
// 组件测试示例
import { render, screen, fireEvent } from '@testing-library/react';
import { ComponentLibrary } from './ComponentLibrary';
import { FlowNode } from './FlowNode';

describe('ComponentLibrary', () => {
  test('renders component categories correctly', () => {
    const mockComponents = [
      { id: '1', name: 'VLOOKUP', category: 'excel' },
      { id: '2', name: '销售分析', category: 'business' }
    ];
    render(<ComponentLibrary components={mockComponents} onComponentDrag={jest.fn()} />);
    
    expect(screen.getByText('VLOOKUP')).toBeInTheDocument();
    expect(screen.getByText('销售分析')).toBeInTheDocument();
  });
  
  test('handles component drag', () => {
    const mockOnDrag = jest.fn();
    const mockComponents = [{ id: '1', name: 'VLOOKUP', category: 'excel' }];
    
    render(<ComponentLibrary components={mockComponents} onComponentDrag={mockOnDrag} />);
    // 模拟拖拽操作
    fireEvent.dragStart(screen.getByText('VLOOKUP'));
    
    expect(mockOnDrag).toHaveBeenCalled();
  });
});

describe('FlowNode', () => {
  test('displays component status correctly', () => {
    const mockNode = {
      id: '1',
      type: 'vlookup',
      data: { name: 'VLOOKUP' },
      status: 'running'
    };
    
    render(<FlowNode node={mockNode} status="running" onParameterChange={jest.fn()} />);
    expect(screen.getByText('⏳')).toBeInTheDocument();
  });
});
```

### 2. 集成测试
- **流程执行测试**: 测试完整的组件流程执行
- **组件连接测试**: 测试组件间数据传递
- **参数验证测试**: 测试参数配置和验证逻辑
- **文件处理测试**: 测试文件上传和解析功能

### 3. E2E测试
- **完整业务流程**: 从文件上传到结果导出的完整流程
- **拖拽操作**: 组件拖拽和连线操作
- **流程保存和加载**: 流程的持久化功能
- **多浏览器兼容性**: 确保在不同浏览器中正常工作
- **性能测试**: 大型流程和大文件处理性能

## 部署和构建

### 1. 构建优化
```json
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['daisyui', '@headlessui/react'],
          workflow: ['reactflow', 'react-dnd'],
          components: ['./src/components/excel', './src/components/business'],
          editor: ['@monaco-editor/react'],
          charts: ['chart.js', 'react-chartjs-2']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  optimizeDeps: {
    include: ['reactflow', 'react-dnd', 'zustand']
  }
});
```

### 2. 环境配置
```typescript
// 环境变量配置
interface Config {
  API_BASE_URL: string;
  UPLOAD_MAX_SIZE: number;
  MAX_WORKFLOW_NODES: number;
  ENABLE_DEBUG: boolean;
  COMPONENT_CACHE_SIZE: number;
}

const config: Config = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  UPLOAD_MAX_SIZE: Number(import.meta.env.VITE_UPLOAD_MAX_SIZE) || 52428800, // 50MB
  MAX_WORKFLOW_NODES: Number(import.meta.env.VITE_MAX_WORKFLOW_NODES) || 100,
  ENABLE_DEBUG: import.meta.env.VITE_ENABLE_DEBUG === 'true',
  COMPONENT_CACHE_SIZE: Number(import.meta.env.VITE_COMPONENT_CACHE_SIZE) || 50
};
```

```bash
# 开发环境
npm run dev

# 生产构建
npm run build

# 预览构建结果
npm run preview
```

### 3. 质量检查
```json
// package.json scripts
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:component": "vitest run src/components",
    "test:workflow": "vitest run src/workflow",
    "build:analyze": "vite build --mode analyze",
    "validate:workflow": "node scripts/validate-workflows.js"
  }
}
```

```bash
# 代码格式化
npm run format

# 代码检查
npm run lint

# 类型检查
npm run type-check

# 测试运行
npm run test
```

### 4. 组件打包策略
- **基础组件**: 打包为独立chunk，支持懒加载
- **业务组件**: 按业务领域分组打包
- **流程模板**: 独立打包，支持动态加载
- **第三方依赖**: 分离vendor chunk，利用浏览器缓存

## 总结

本UI设计文档为Excel简化操作工具提供了完整的组件化和流程化设计指导，核心优势包括：

### 🧩 组件化设计
- 模块化的组件库，支持拖拽式操作
- 标准化的组件接口，易于扩展
- 智能的参数配置，降低使用门槛
- 可复用的业务组件，提升效率

### 🔄 流程化操作
- 可视化的流程设计器
- 直观的数据流向展示
- 实时的执行状态监控
- 灵活的流程保存和分享

### 🎯 专业化体验
- 深度整合Excel功能特性
- 保持用户原有操作习惯
- 专业的数据处理能力
- 现代化的界面设计

### 🚀 智能化辅助
- 智能参数推荐和验证
- 自动化的数据类型识别
- 基于历史的操作建议
- 错误预防和智能提示

### ⚡ 高性能架构
- 组件懒加载和按需渲染
- 流程并行执行优化
- 大文件分块处理
- 智能缓存策略

### ♿ 全面可访问性
- 完整的键盘导航支持
- 组件状态的多维度反馈
- 屏幕阅读器友好设计
- 高对比度和无障碍优化

### 🔧 开发规范化
- 完整的TypeScript类型定义
- 统一的组件和流程命名规范
- 全面的测试策略覆盖
- 模块化的构建和部署方案

通过遵循这些设计原则和规范，我们构建了一个既专业又易用的Excel操作工具，通过组件化和流程化的设计理念，为用户提供了更高效、更智能的数据处理体验。