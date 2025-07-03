import React, { useState, useEffect, useMemo } from 'react';

interface ProcessingStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  duration?: number;
  details?: string[];
  progress?: number;
  startTime?: number;
  endTime?: number;
  subSteps?: ProcessingSubStep[];
}

interface ProcessingSubStep {
  id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
}

interface EnhancedProcessingVisualizationProps {
  steps: ProcessingStep[];
  currentStep?: string;
  onStepClick?: (stepId: string) => void;
  showDetails?: boolean;
  compact?: boolean;
  showTimeline?: boolean;
  showProgress?: boolean;
}

// 增强的默认处理步骤
const ENHANCED_DEFAULT_STEPS: ProcessingStep[] = [
  {
    id: 'understanding',
    title: '🧠 理解需求',
    description: '分析用户的自然语言输入，理解分析意图',
    status: 'pending',
    details: [
      '解析关键词和短语',
      '识别分析类型和目标',
      '确定相关数据源',
      '评估查询复杂度'
    ],
    subSteps: [
      { id: 'parse', title: '语义解析', status: 'pending' },
      { id: 'intent', title: '意图识别', status: 'pending' },
      { id: 'validate', title: '需求验证', status: 'pending' }
    ]
  },
  {
    id: 'schema_analysis',
    title: '🗄️ 数据结构分析',
    description: '分析表结构和字段信息，建立数据模型',
    status: 'pending',
    details: [
      '获取数据库架构信息',
      '识别相关表和字段',
      '分析数据类型和约束',
      '建立字段关联关系'
    ],
    subSteps: [
      { id: 'schema', title: '架构获取', status: 'pending' },
      { id: 'fields', title: '字段分析', status: 'pending' },
      { id: 'relations', title: '关系映射', status: 'pending' }
    ]
  },
  {
    id: 'sql_generation',
    title: '⚡ SQL生成',
    description: '根据需求生成优化的SQL查询语句',
    status: 'pending',
    details: [
      '构建查询逻辑结构',
      '优化查询性能',
      '验证SQL语法正确性',
      '添加安全性检查'
    ],
    subSteps: [
      { id: 'logic', title: '逻辑构建', status: 'pending' },
      { id: 'optimize', title: '性能优化', status: 'pending' },
      { id: 'validate', title: '语法验证', status: 'pending' }
    ]
  },
  {
    id: 'execution',
    title: '🚀 执行查询',
    description: '安全执行SQL查询并获取结果数据',
    status: 'pending',
    details: [
      '建立数据库连接',
      '执行查询语句',
      '处理查询结果',
      '错误处理和重试'
    ],
    subSteps: [
      { id: 'connect', title: '连接数据库', status: 'pending' },
      { id: 'execute', title: '执行查询', status: 'pending' },
      { id: 'fetch', title: '获取结果', status: 'pending' }
    ]
  },
  {
    id: 'analysis',
    title: '📊 结果分析',
    description: '深度分析查询结果并生成智能洞察',
    status: 'pending',
    details: [
      '数据统计分析',
      '趋势和模式识别',
      '异常值检测',
      '生成可视化建议'
    ],
    subSteps: [
      { id: 'stats', title: '统计分析', status: 'pending' },
      { id: 'patterns', title: '模式识别', status: 'pending' },
      { id: 'insights', title: '洞察生成', status: 'pending' }
    ]
  }
];

// 获取步骤状态图标
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending': return '⏳';
    case 'processing': return '🔄';
    case 'completed': return '✅';
    case 'error': return '❌';
    default: return '⏳';
  }
};

// 获取步骤状态颜色
const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'text-base-content/50';
    case 'processing': return 'text-primary';
    case 'completed': return 'text-success';
    case 'error': return 'text-error';
    default: return 'text-base-content/50';
  }
};

// 获取进度条颜色
const getProgressColor = (status: string) => {
  switch (status) {
    case 'processing': return 'progress-primary';
    case 'completed': return 'progress-success';
    case 'error': return 'progress-error';
    default: return 'progress-ghost';
  }
};

// 格式化持续时间
const formatDuration = (duration?: number) => {
  if (!duration) return '';
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(1)}s`;
};

export const EnhancedProcessingVisualization: React.FC<EnhancedProcessingVisualizationProps> = ({
  steps = ENHANCED_DEFAULT_STEPS,
  currentStep,
  onStepClick,
  showDetails = true,
  compact = false,
  showTimeline = true,
  showProgress = true
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [animationFrame, setAnimationFrame] = useState(0);
  const [realTimeProgress, setRealTimeProgress] = useState<Record<string, number>>({});

  // 动画效果
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % 4);
    }, 300);

    return () => clearInterval(interval);
  }, []);

  // 实时进度更新
  useEffect(() => {
    const processingSteps = steps.filter(step => step.status === 'processing');
    
    if (processingSteps.length > 0) {
      const interval = setInterval(() => {
        setRealTimeProgress(prev => {
          const newProgress = { ...prev };
          processingSteps.forEach(step => {
            if (step.progress !== undefined) {
              newProgress[step.id] = step.progress;
            } else {
              // 模拟进度增长
              const current = newProgress[step.id] || 0;
              if (current < 90) {
                newProgress[step.id] = Math.min(90, current + Math.random() * 5);
              }
            }
          });
          return newProgress;
        });
      }, 500);

      return () => clearInterval(interval);
    }
  }, [steps]);

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

  // 计算总体进度
  const overallProgress = useMemo(() => {
    const completedSteps = steps.filter(step => step.status === 'completed').length;
    const processingSteps = steps.filter(step => step.status === 'processing');
    let progress = (completedSteps / steps.length) * 100;
    
    // 加上正在处理步骤的进度
    if (processingSteps.length > 0) {
      const processingProgress = processingSteps.reduce((sum, step) => {
        const stepProgress = realTimeProgress[step.id] || step.progress || 0;
        return sum + stepProgress;
      }, 0);
      progress += (processingProgress / processingSteps.length / steps.length);
    }
    
    return Math.min(100, progress);
  }, [steps, realTimeProgress]);

  // 计算总耗时
  const totalDuration = useMemo(() => {
    return steps.reduce((total, step) => total + (step.duration || 0), 0);
  }, [steps]);

  if (compact) {
    return (
      <div className="bg-base-200 p-3 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">处理进度</span>
              <span className="text-xs text-base-content/60">
                {Math.round(overallProgress)}% • {formatDuration(totalDuration)}
              </span>
            </div>
            <progress 
              className="progress progress-primary w-full h-2" 
              value={overallProgress} 
              max="100"
            ></progress>
          </div>
          <div className="flex space-x-1">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`w-3 h-3 rounded-full border-2 transition-all ${
                  step.status === 'completed' ? 'bg-success border-success' :
                  step.status === 'processing' ? 'bg-primary border-primary animate-pulse' :
                  step.status === 'error' ? 'bg-error border-error' :
                  'bg-base-300 border-base-300'
                }`}
                title={step.title}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 总体进度 */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-4 rounded-lg border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-lg">🚀</span>
            <h3 className="font-semibold">AI 处理进度</h3>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{Math.round(overallProgress)}%</div>
            <div className="text-xs text-base-content/60">
              {steps.filter(s => s.status === 'completed').length}/{steps.length} 步骤完成
            </div>
          </div>
        </div>
        
        {showProgress && (
          <div className="space-y-2">
            <progress 
              className="progress progress-primary w-full h-3" 
              value={overallProgress} 
              max="100"
            ></progress>
            <div className="flex justify-between text-xs text-base-content/60">
              <span>开始</span>
              {totalDuration > 0 && <span>耗时: {formatDuration(totalDuration)}</span>}
              <span>完成</span>
            </div>
          </div>
        )}
      </div>

      {/* 步骤列表 */}
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isExpanded = expandedSteps.has(step.id);
          const isActive = currentStep === step.id;
          const stepProgress = realTimeProgress[step.id] || step.progress || 0;
          
          return (
            <div
              key={step.id}
              className={`border rounded-lg transition-all duration-300 ${
                isActive ? 'border-primary bg-primary/5 shadow-md' : 'border-base-300 bg-base-100'
              } ${step.status === 'error' ? 'border-error bg-error/5' : ''}`}
            >
              {/* 步骤头部 */}
              <div
                className={`p-4 cursor-pointer hover:bg-base-50 transition-colors ${
                  onStepClick ? 'cursor-pointer' : 'cursor-default'
                }`}
                onClick={() => {
                  if (onStepClick) onStepClick(step.id);
                  if (showDetails) toggleStepDetails(step.id);
                }}
              >
                <div className="flex items-center space-x-4">
                  {/* 时间线连接线 */}
                  {showTimeline && index < steps.length - 1 && (
                    <div className="absolute left-8 mt-16 w-0.5 h-8 bg-base-300"></div>
                  )}
                  
                  {/* 步骤图标 */}
                  <div className={`relative flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center ${
                    step.status === 'completed' ? 'border-success bg-success text-white' :
                    step.status === 'processing' ? 'border-primary bg-primary text-white' :
                    step.status === 'error' ? 'border-error bg-error text-white' :
                    'border-base-300 bg-base-200'
                  }`}>
                    <span className={`text-lg ${
                      step.status === 'processing' ? 'animate-spin' : ''
                    }`}>
                      {getStatusIcon(step.status)}
                    </span>
                    
                    {/* 处理中的动画环 */}
                    {step.status === 'processing' && (
                      <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
                    )}
                  </div>
                  
                  {/* 步骤信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className={`font-medium truncate ${getStatusColor(step.status)}`}>
                        {step.title}
                      </h4>
                      <div className="flex items-center space-x-2 text-xs text-base-content/60">
                        {step.duration && (
                          <span>{formatDuration(step.duration)}</span>
                        )}
                        {step.status === 'processing' && (
                          <span className="loading loading-dots loading-xs"></span>
                        )}
                        {showDetails && (
                          <span className={`transform transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}>▼</span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-base-content/70 mb-2">{step.description}</p>
                    
                    {/* 进度条 */}
                    {showProgress && (step.status === 'processing' || step.status === 'completed') && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>进度</span>
                          <span>{Math.round(stepProgress)}%</span>
                        </div>
                        <progress 
                          className={`progress w-full h-2 ${getProgressColor(step.status)}`}
                          value={step.status === 'completed' ? 100 : stepProgress}
                          max="100"
                        ></progress>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* 展开的详细信息 */}
              {isExpanded && showDetails && (
                <div className="border-t border-base-200 p-4 bg-base-50">
                  {/* 子步骤 */}
                  {step.subSteps && step.subSteps.length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-medium text-sm mb-2">子步骤:</h5>
                      <div className="space-y-2">
                        {step.subSteps.map(subStep => (
                          <div key={subStep.id} className="flex items-center space-x-3 text-sm">
                            <span className={getStatusColor(subStep.status)}>
                              {getStatusIcon(subStep.status)}
                            </span>
                            <span className="flex-1">{subStep.title}</span>
                            {subStep.progress !== undefined && (
                              <div className="w-16">
                                <progress 
                                  className={`progress progress-xs ${getProgressColor(subStep.status)}`}
                                  value={subStep.progress}
                                  max="100"
                                ></progress>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 详细信息 */}
                  {step.details && step.details.length > 0 && (
                    <div>
                      <h5 className="font-medium text-sm mb-2">详细信息:</h5>
                      <ul className="space-y-1 text-sm text-base-content/70">
                        {step.details.map((detail, i) => (
                          <li key={i} className="flex items-start space-x-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* 时间信息 */}
                  {(step.startTime || step.endTime) && (
                    <div className="mt-3 pt-3 border-t border-base-200">
                      <div className="grid grid-cols-2 gap-4 text-xs text-base-content/60">
                        {step.startTime && (
                          <div>
                            <span className="font-medium">开始时间:</span>
                            <div>{new Date(step.startTime).toLocaleTimeString()}</div>
                          </div>
                        )}
                        {step.endTime && (
                          <div>
                            <span className="font-medium">结束时间:</span>
                            <div>{new Date(step.endTime).toLocaleTimeString()}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* 状态总结 */}
      <div className="bg-base-200 p-3 rounded-lg">
        <div className="grid grid-cols-4 gap-4 text-center text-sm">
          <div>
            <div className="text-lg font-bold text-base-content/60">
              {steps.filter(s => s.status === 'pending').length}
            </div>
            <div className="text-xs text-base-content/50">等待中</div>
          </div>
          <div>
            <div className="text-lg font-bold text-primary">
              {steps.filter(s => s.status === 'processing').length}
            </div>
            <div className="text-xs text-base-content/50">处理中</div>
          </div>
          <div>
            <div className="text-lg font-bold text-success">
              {steps.filter(s => s.status === 'completed').length}
            </div>
            <div className="text-xs text-base-content/50">已完成</div>
          </div>
          <div>
            <div className="text-lg font-bold text-error">
              {steps.filter(s => s.status === 'error').length}
            </div>
            <div className="text-xs text-base-content/50">错误</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedProcessingVisualization;