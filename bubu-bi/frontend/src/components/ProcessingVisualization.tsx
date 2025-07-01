import React, { useState, useEffect } from 'react';

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  duration?: number;
  details?: string[];
  progress?: number;
}

interface ProcessingVisualizationProps {
  steps: ProcessingStep[];
  currentStep?: string;
  onStepClick?: (stepId: string) => void;
  showDetails?: boolean;
  compact?: boolean;
}

// 预定义的AI分析步骤
const DEFAULT_ANALYSIS_STEPS: ProcessingStep[] = [
  {
    id: 'understanding',
    title: '理解需求',
    description: '分析用户的自然语言输入，理解分析意图',
    status: 'pending',
    details: [
      '解析关键词和短语',
      '识别分析类型',
      '确定目标数据'
    ]
  },
  {
    id: 'schema_analysis',
    title: '数据结构分析',
    description: '分析表结构和字段信息',
    status: 'pending',
    details: [
      '获取表结构信息',
      '识别相关字段',
      '分析数据类型'
    ]
  },
  {
    id: 'sql_generation',
    title: 'SQL生成',
    description: '根据需求生成相应的SQL查询语句',
    status: 'pending',
    details: [
      '构建查询逻辑',
      '优化查询性能',
      '验证SQL语法'
    ]
  },
  {
    id: 'execution',
    title: '执行查询',
    description: '执行生成的SQL并获取结果',
    status: 'pending',
    details: [
      '连接数据库',
      '执行查询语句',
      '处理查询结果'
    ]
  },
  {
    id: 'analysis',
    title: '结果分析',
    description: '分析查询结果并生成洞察',
    status: 'pending',
    details: [
      '数据统计分析',
      '趋势识别',
      '异常检测'
    ]
  }
];

export const ProcessingVisualization: React.FC<ProcessingVisualizationProps> = ({
  steps = DEFAULT_ANALYSIS_STEPS,
  currentStep,
  onStepClick,
  showDetails = true,
  compact = false
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [animationStep, setAnimationStep] = useState(0);

  // 动画效果
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationStep(prev => (prev + 1) % 3);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // 切换步骤详情展开状态
  const toggleStepDetails = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  // 获取步骤状态图标
  const getStatusIcon = (status: ProcessingStep['status'], isActive: boolean) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      case 'processing':
        return isActive ? '🔄' : '⏳';
      default:
        return '⭕';
    }
  };

  // 获取步骤状态颜色
  const getStatusColor = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return 'text-success';
      case 'error':
        return 'text-error';
      case 'processing':
        return 'text-warning';
      default:
        return 'text-base-content/50';
    }
  };

  // 获取连接线样式
  const getConnectorStyle = (index: number, status: ProcessingStep['status']) => {
    if (index === steps.length - 1) return 'hidden';
    
    const baseClass = 'absolute left-4 top-8 w-0.5 h-8 transform -translate-x-0.5';
    
    switch (status) {
      case 'completed':
        return `${baseClass} bg-success`;
      case 'processing':
        return `${baseClass} bg-warning`;
      case 'error':
        return `${baseClass} bg-error`;
      default:
        return `${baseClass} bg-base-300`;
    }
  };

  // 渲染进度条
  const renderProgressBar = (step: ProcessingStep) => {
    if (step.status !== 'processing' || step.progress === undefined) return null;

    return (
      <div className="mt-2">
        <div className="flex items-center justify-between text-xs text-base-content/70 mb-1">
          <span>进度</span>
          <span>{step.progress}%</span>
        </div>
        <div className="w-full bg-base-300 rounded-full h-1.5">
          <div 
            className="bg-warning h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${step.progress}%` }}
          ></div>
        </div>
      </div>
    );
  };

  // 渲染步骤详情
  const renderStepDetails = (step: ProcessingStep) => {
    if (!showDetails || !expandedSteps.has(step.id)) return null;

    return (
      <div className="mt-3 pl-6 border-l-2 border-base-300">
        {step.details && step.details.length > 0 && (
          <div className="space-y-1">
            {step.details.map((detail, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm text-base-content/70">
                <span className="w-1 h-1 bg-base-content/30 rounded-full"></span>
                <span>{detail}</span>
              </div>
            ))}
          </div>
        )}
        
        {step.duration && (
          <div className="mt-2 text-xs text-base-content/50">
            耗时: {step.duration}ms
          </div>
        )}
      </div>
    );
  };

  // 渲染单个步骤
  const renderStep = (step: ProcessingStep, index: number) => {
    const isActive = currentStep === step.id;
    const isClickable = onStepClick && (step.status === 'completed' || step.status === 'error');
    
    return (
      <div key={step.id} className="relative">
        {/* 连接线 */}
        <div className={getConnectorStyle(index, step.status)}></div>
        
        {/* 步骤内容 */}
        <div 
          className={`flex items-start space-x-3 p-3 rounded-lg transition-all duration-200 ${
            isActive ? 'bg-warning/10 border border-warning/20' : 'hover:bg-base-200'
          } ${
            isClickable ? 'cursor-pointer' : ''
          }`}
          onClick={() => {
            if (isClickable) {
              onStepClick!(step.id);
            }
            if (showDetails) {
              toggleStepDetails(step.id);
            }
          }}
        >
          {/* 状态图标 */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
            isActive ? 'bg-warning text-warning-content' : 'bg-base-300'
          }`}>
            <span className={`${isActive && step.status === 'processing' ? 'animate-spin' : ''}`}>
              {getStatusIcon(step.status, isActive)}
            </span>
          </div>

          {/* 步骤信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className={`font-medium ${getStatusColor(step.status)}`}>
                {step.title}
              </h4>
              {showDetails && step.details && (
                <button className="text-xs text-base-content/50 hover:text-base-content">
                  {expandedSteps.has(step.id) ? '收起' : '详情'}
                </button>
              )}
            </div>
            
            <p className="text-sm text-base-content/70 mt-1">
              {step.description}
            </p>
            
            {/* 进度条 */}
            {renderProgressBar(step)}
            
            {/* 处理动画 */}
            {isActive && step.status === 'processing' && (
              <div className="flex items-center space-x-1 mt-2">
                <span className="text-xs text-warning">处理中</span>
                <div className="flex space-x-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`w-1 h-1 bg-warning rounded-full transition-opacity duration-300 ${
                        animationStep === i ? 'opacity-100' : 'opacity-30'
                      }`}
                    ></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 步骤详情 */}
        {renderStepDetails(step)}
      </div>
    );
  };

  // 紧凑模式渲染
  if (compact) {
    return (
      <div className="flex items-center space-x-2 p-2 bg-base-200 rounded-lg">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          return (
            <div key={step.id} className="flex items-center space-x-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                isActive ? 'bg-warning text-warning-content' : 
                step.status === 'completed' ? 'bg-success text-success-content' :
                step.status === 'error' ? 'bg-error text-error-content' :
                'bg-base-300'
              }`}>
                <span className={isActive && step.status === 'processing' ? 'animate-spin' : ''}>
                  {getStatusIcon(step.status, isActive)}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-4 h-0.5 ${
                  step.status === 'completed' ? 'bg-success' : 'bg-base-300'
                }`}></div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-base-100 rounded-lg border border-base-300">
      {/* 标题 */}
      <div className="p-4 border-b border-base-300">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center space-x-2">
            <span>🔄</span>
            <span>AI分析过程</span>
          </h3>
          <div className="text-xs text-base-content/50">
            {steps.filter(s => s.status === 'completed').length} / {steps.length} 完成
          </div>
        </div>
      </div>
      
      {/* 步骤列表 */}
      <div className="p-4 space-y-2">
        {steps.map(renderStep)}
      </div>
    </div>
  );
};