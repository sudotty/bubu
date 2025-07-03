import React, { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import { main } from '../../wailsjs/go/models';

type LLMProcessResult = main.LLMProcessResult;

interface EnhancedPromptModalProps {
  showSqlPreview: boolean;
  setShowSqlPreview: (show: boolean) => void;
  llmResult: LLMProcessResult | null;
  setLlmResult: (result: LLMProcessResult | null) => void;
  onExecuteLLMQuery: () => void;
  onCopy: (text: string, type: string) => void;
  generateSystemPrompt: () => Promise<string>;
  loading: boolean;
  onSqlEdit?: (sql: string) => void;
}

interface SqlValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

// SQL语法验证
const validateSql = (sql: string): SqlValidationResult => {
  const result: SqlValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: []
  };

  if (!sql.trim()) {
    result.isValid = false;
    result.errors.push('SQL语句不能为空');
    return result;
  }

  const upperSql = sql.toUpperCase();
  
  // 基础语法检查
  const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'JOIN', 'INSERT', 'UPDATE', 'DELETE'];
  const hasValidKeyword = sqlKeywords.some(keyword => upperSql.includes(keyword));
  
  if (!hasValidKeyword) {
    result.isValid = false;
    result.errors.push('未检测到有效的SQL关键字');
  }

  // 括号匹配检查
  const openParens = (sql.match(/\(/g) || []).length;
  const closeParens = (sql.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    result.isValid = false;
    result.errors.push('括号不匹配');
  }

  // 引号匹配检查
  const singleQuotes = (sql.match(/'/g) || []).length;
  const doubleQuotes = (sql.match(/"/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    result.warnings.push('单引号可能不匹配');
  }
  if (doubleQuotes % 2 !== 0) {
    result.warnings.push('双引号可能不匹配');
  }

  // 性能建议
  if (upperSql.includes('SELECT *')) {
    result.suggestions.push('建议明确指定需要的列名，避免使用 SELECT *');
  }
  
  if (upperSql.includes('WHERE') && !upperSql.includes('LIMIT')) {
    result.suggestions.push('考虑添加 LIMIT 子句以限制结果数量');
  }

  if (upperSql.includes('ORDER BY') && !upperSql.includes('LIMIT')) {
    result.suggestions.push('使用 ORDER BY 时建议添加 LIMIT 以提升性能');
  }

  return result;
};

// SQL格式化
const formatSql = (sql: string): string => {
  return sql
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',\n    ')
    .replace(/\bSELECT\b/gi, 'SELECT')
    .replace(/\bFROM\b/gi, '\nFROM')
    .replace(/\bWHERE\b/gi, '\nWHERE')
    .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
    .replace(/\bORDER BY\b/gi, '\nORDER BY')
    .replace(/\bHAVING\b/gi, '\nHAVING')
    .replace(/\bJOIN\b/gi, '\nJOIN')
    .replace(/\bLEFT JOIN\b/gi, '\nLEFT JOIN')
    .replace(/\bRIGHT JOIN\b/gi, '\nRIGHT JOIN')
    .replace(/\bINNER JOIN\b/gi, '\nINNER JOIN')
    .trim();
};

export const EnhancedPromptModal: React.FC<EnhancedPromptModalProps> = ({
  showSqlPreview,
  setShowSqlPreview,
  llmResult,
  setLlmResult,
  onExecuteLLMQuery,
  onCopy,
  generateSystemPrompt,
  loading,
  onSqlEdit
}) => {
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [editedSql, setEditedSql] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [sqlValidation, setSqlValidation] = useState<SqlValidationResult | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [fontSize, setFontSize] = useState(14);
  const editorRef = useRef<any>(null);

  // 初始化编辑的SQL
  useEffect(() => {
    if (llmResult?.sql && !isEditing) {
      setEditedSql(llmResult.sql);
    }
  }, [llmResult?.sql, isEditing]);

  // 实时验证SQL
  useEffect(() => {
    if (editedSql && isEditing) {
      const validation = validateSql(editedSql);
      setSqlValidation(validation);
    }
  }, [editedSql, isEditing]);

  const handleShowPrompt = async () => {
    setLoadingPrompt(true);
    try {
      const prompt = await generateSystemPrompt();
      setSystemPrompt(prompt);
      setShowPromptModal(true);
    } catch (error) {
      console.error('生成系统提示词失败:', error);
    } finally {
      setLoadingPrompt(false);
    }
  };

  const handleSqlEdit = (value: string | undefined) => {
    if (value !== undefined) {
      setEditedSql(value);
      onSqlEdit?.(value);
    }
  };

  const handleFormatSql = () => {
    const formatted = formatSql(editedSql);
    setEditedSql(formatted);
    if (editorRef.current) {
      editorRef.current.setValue(formatted);
    }
  };

  const handleApplyChanges = () => {
    if (llmResult) {
      const updatedResult: LLMProcessResult = {
        ...llmResult,
        sql: editedSql,
        convertValues: llmResult.convertValues
      };
      setLlmResult(updatedResult);
      setIsEditing(false);
    }
  };

  const handleResetSql = () => {
    if (llmResult?.sql) {
      setEditedSql(llmResult.sql);
      if (editorRef.current) {
        editorRef.current.setValue(llmResult.sql);
      }
    }
  };

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    
    // 添加快捷键
    editor.addCommand(editor.KeyMod.CtrlCmd | editor.KeyCode.KeyS, () => {
      handleApplyChanges();
    });
    
    editor.addCommand(editor.KeyMod.CtrlCmd | editor.KeyMod.Shift | editor.KeyCode.KeyF, () => {
      handleFormatSql();
    });
  };

  return (
    <>
      {/* SQL预览和编辑模态框 */}
      {showSqlPreview && llmResult && (
        <div className="modal modal-open">
          <div className="modal-box max-w-6xl h-5/6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">🔍 LLM处理结果</h3>
              <div className="flex items-center space-x-2">
                <div className="dropdown dropdown-end">
                  <label tabIndex={0} className="btn btn-ghost btn-sm">
                    ⚙️ 设置
                  </label>
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                    <li>
                      <label className="label cursor-pointer">
                        <span className="label-text">深色主题</span>
                        <input 
                          type="checkbox" 
                          className="toggle toggle-sm"
                          checked={editorTheme === 'vs-dark'}
                          onChange={(e) => setEditorTheme(e.target.checked ? 'vs-dark' : 'light')}
                        />
                      </label>
                    </li>
                    <li>
                      <label className="label cursor-pointer">
                        <span className="label-text">字体大小</span>
                        <select 
                          className="select select-xs"
                          value={fontSize}
                          onChange={(e) => setFontSize(Number(e.target.value))}
                        >
                          <option value={12}>12px</option>
                          <option value={14}>14px</option>
                          <option value={16}>16px</option>
                          <option value={18}>18px</option>
                        </select>
                      </label>
                    </li>
                  </ul>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowValidation(!showValidation)}
                >
                  {showValidation ? '🔍 隐藏验证' : '🔍 显示验证'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
              {/* SQL编辑器 */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">SQL语句:</span>
                    {isEditing && (
                      <span className="badge badge-warning badge-sm">编辑中</span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      className="btn btn-outline btn-xs"
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? '📖 预览' : '✏️ 编辑'}
                    </button>
                    {isEditing && (
                      <>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={handleFormatSql}
                          title="Ctrl+Shift+F"
                        >
                          🎨 格式化
                        </button>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={handleResetSql}
                        >
                          🔄 重置
                        </button>
                      </>
                    )}
                    <button
                      className="btn btn-outline btn-xs"
                      onClick={() => onCopy(editedSql || llmResult.sql, 'SQL语句')}
                    >
                      📋 复制
                    </button>
                  </div>
                </div>
                
                <div className="border rounded-lg overflow-hidden" style={{ height: '400px' }}>
                  {isEditing ? (
                    <Editor
                      height="100%"
                      defaultLanguage="sql"
                      value={editedSql}
                      onChange={handleSqlEdit}
                      onMount={handleEditorDidMount}
                      theme={editorTheme}
                      options={{
                        fontSize,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        folding: true,
                        selectOnLineNumbers: true,
                        automaticLayout: true,
                        tabSize: 2,
                        insertSpaces: true,
                        formatOnPaste: true,
                        formatOnType: true
                      }}
                    />
                  ) : (
                    <div className="mockup-code h-full overflow-auto">
                      <pre className="px-4 py-2 h-full">
                        <code>{editedSql || llmResult.sql}</code>
                      </pre>
                    </div>
                  )}
                </div>
                
                {/* 编辑操作按钮 */}
                {isEditing && (
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-base-content/60">
                      💡 快捷键: Ctrl+S 保存, Ctrl+Shift+F 格式化
                    </div>
                    <div className="flex space-x-2">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setIsEditing(false)}
                      >
                        取消
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleApplyChanges}
                        title="Ctrl+S"
                      >
                        ✅ 应用更改
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 侧边栏信息 */}
              <div className="space-y-4">
                {/* 解释说明 */}
                {llmResult.description && (
                  <div className="bg-base-200 p-3 rounded-lg">
                    <h4 className="font-medium mb-2">💡 解释说明:</h4>
                    <p className="text-sm">{llmResult.description}</p>
                  </div>
                )}

                {/* 置信度 */}
                {llmResult.confidence !== undefined && (
                  <div className="bg-base-200 p-3 rounded-lg">
                    <h4 className="font-medium mb-2">📊 置信度:</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">准确性评估</span>
                        <span className="text-sm font-medium">{(llmResult.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <progress
                        className={`progress w-full ${
                          llmResult.confidence > 0.8 ? 'progress-success' :
                          llmResult.confidence > 0.6 ? 'progress-warning' : 'progress-error'
                        }`}
                        value={llmResult.confidence * 100}
                        max={100}
                      ></progress>
                      <div className="text-xs text-base-content/60">
                        {llmResult.confidence > 0.8 ? '高置信度 - 建议直接执行' :
                         llmResult.confidence > 0.6 ? '中等置信度 - 建议检查后执行' :
                         '低置信度 - 建议仔细检查'}
                      </div>
                    </div>
                  </div>
                )}

                {/* SQL验证结果 */}
                {showValidation && sqlValidation && (
                  <div className="bg-base-200 p-3 rounded-lg">
                    <h4 className="font-medium mb-2">🔍 SQL验证:</h4>
                    <div className="space-y-2">
                      <div className={`flex items-center space-x-2 ${
                        sqlValidation.isValid ? 'text-success' : 'text-error'
                      }`}>
                        <span>{sqlValidation.isValid ? '✅' : '❌'}</span>
                        <span className="text-sm font-medium">
                          {sqlValidation.isValid ? '语法正确' : '发现错误'}
                        </span>
                      </div>
                      
                      {sqlValidation.errors.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-error mb-1">错误:</div>
                          {sqlValidation.errors.map((error, i) => (
                            <div key={i} className="text-xs text-error">• {error}</div>
                          ))}
                        </div>
                      )}
                      
                      {sqlValidation.warnings.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-warning mb-1">警告:</div>
                          {sqlValidation.warnings.map((warning, i) => (
                            <div key={i} className="text-xs text-warning">• {warning}</div>
                          ))}
                        </div>
                      )}
                      
                      {sqlValidation.suggestions.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-info mb-1">建议:</div>
                          {sqlValidation.suggestions.map((suggestion, i) => (
                            <div key={i} className="text-xs text-info">• {suggestion}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 快速操作 */}
                <div className="bg-base-200 p-3 rounded-lg">
                  <h4 className="font-medium mb-2">⚡ 快速操作:</h4>
                  <div className="space-y-2">
                    <button
                      className="btn btn-outline btn-sm w-full"
                      onClick={handleShowPrompt}
                      disabled={loadingPrompt}
                    >
                      {loadingPrompt ? (
                        <>
                          <span className="loading loading-spinner loading-xs"></span>
                          生成中...
                        </>
                      ) : (
                        '🔍 查看Prompt'
                      )}
                    </button>
                    <button
                      className="btn btn-outline btn-sm w-full"
                      onClick={() => onCopy(JSON.stringify(llmResult, null, 2), 'LLM结果')}
                    >
                      📋 复制全部
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 底部操作按钮 */}
            <div className="modal-action">
              <button
                className="btn btn-primary"
                onClick={onExecuteLLMQuery}
                disabled={loading || (sqlValidation ? !sqlValidation.isValid : false)}
              >
                {loading ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    执行中...
                  </>
                ) : (
                  '🚀 执行SQL'
                )}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setShowSqlPreview(false);
                  setLlmResult(null);
                  setIsEditing(false);
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt查看模态框 */}
      {showPromptModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4">🤖 系统Prompt</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-base-content/70">
                  当前数据库结构的系统提示词
                </span>
                <div className="flex space-x-2">
                  <button
                    className="btn btn-outline btn-xs"
                    onClick={() => onCopy(systemPrompt, '系统Prompt')}
                  >
                    📋 复制Prompt
                  </button>
                  <button
                    className="btn btn-outline btn-xs"
                    onClick={() => {
                      const blob = new Blob([systemPrompt], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'system-prompt.txt';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    💾 下载
                  </button>
                </div>
              </div>
              <div className="border rounded-lg" style={{ height: '500px' }}>
                <Editor
                  height="100%"
                  defaultLanguage="markdown"
                  value={systemPrompt}
                  theme={editorTheme}
                  options={{
                    fontSize,
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    lineNumbers: 'on'
                  }}
                />
              </div>
            </div>
            <div className="modal-action">
              <button className="btn" onClick={() => setShowPromptModal(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EnhancedPromptModal;